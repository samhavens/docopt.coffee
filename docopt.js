/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const print = function () {
  return console.log([].join.call(arguments, ' '));
};

class DocoptLanguageError extends Error {
  constructor(message) {
    super();
    this.message = message;
    print(this.message);
  }
}

class DocoptExit extends Error {
  constructor(message) {
    super(message);
    if (message) {
      print(message);
    }
    process.exit(1);
  }
}

class Pattern {
  static initClass() {
    this.prototype.valueOf = this.toString;
  }

  constructor(children = []) {
    this.children = children;
  }

  toString() {
    const formals = this.children.join(', ');
    return `${this.constructor.name}(${formals})`;
  }

  match() {
    throw new Error(`classes inheriting from Pattern
must overload the match method`);
  }

  flat() {
    if (!this.hasOwnProperty('children')) {
      return [this];
    }
    let res = [];
    for (const child of Array.from(this.children)) {
      res = res.concat(child.flat());
    }
    return res;
  }

  fix() {
    this.fixIdentities();
    return this.fix_list_arguments();
  }

  fixIdentities(uniq = this.flat().map(x => Object.assign({}, { x }))) {
    let c;
    // Make pattern-tree tips point to same object if they are equal.

    if (!Object.prototype.hasOwnProperty.call(this, 'children')) {
      return this;
    }

    let i = 0;
    const enumerate = (() => {
      const result = [];
      for (c of Array.from(this.children)) {
        result.push([i++, c]);
      }
      return result;
    })();
    for ([i, c] of Array.from(enumerate)) {
      if (!c.hasOwnProperty('children')) {
        this.children[i] = uniq[c];
      } else {
        c.fixIdentities(uniq);
      }
    }
    return this;
  }

  fix_list_arguments() {
    let c;
    // Find arguments that should accumulate values and fix them
    const either = (() => {
      const result = [];
      for (c of Array.from(this.either().children)) {
        result.push(c.children);
      }
      return result;
    })();
    for (const child of Array.from(either)) {
      const counts = {};
      for (c of Array.from(child)) {
        counts[c] = (counts[c] != null ? counts[c] : 0) + 1;
      }
      for (const e of Array.from(child)) {
        if (counts[e] > 1 && e.constructor === Argument) {
          e.value = [];
        }
      }
    }
    return this;
  }

  either() {
    let c;
    if (!this.hasOwnProperty('children')) {
      return new Either([new Required([this])]);
    }
    const ret = [];
    const groups = [[this]];
    while (groups.length) {
      let either, group, name, oneormore, optional, required;
      const children = groups.shift();
      let [i, indices, types] = Array.from([0, {}, {}]);
      const zip = (() => {
        const result = [];
        for (c of Array.from(children)) {
          result.push([i++, c]);
        }
        return result;
      })();
      for ([i, c] of Array.from(zip)) {
        ({ name } = c.constructor);
        if (!(name in types)) {
          types[name] = [];
        }
        types[name].push(c);
        if (!(c in indices)) {
          indices[c] = i;
        }
      }
      if ((either = types[Either.name])) {
        either = either[0];
        children.splice(indices[either], 1);
        for (c of Array.from(either.children)) {
          group = [c].concat(children);
          groups.push(group);
        }
      } else if ((required = types[Required.name])) {
        required = required[0];
        children.splice(indices[required], 1);
        group = required.children.concat(children);
        groups.push(group);
      } else if ((optional = types[Optional.name])) {
        optional = optional[0];
        children.splice(indices[optional], 1);
        group = optional.children.concat(children);
        groups.push(group);
      } else if ((oneormore = types[OneOrMore.name])) {
        oneormore = oneormore[0];
        children.splice(indices[oneormore], 1);
        group = oneormore.children;
        group = group.concat(group, children);
        groups.push(group);
      } else {
        ret.push(children);
      }
    }
    return new Either(Array.from(ret).map(e => new Required(e)));
  }
}
Pattern.initClass();

class Argument extends Pattern {
  constructor(argname, value = null) {
    super();
    this.argname = argname;
    this.value = value;
  }

  name() {
    return this.argname;
  }

  toString() {
    return `Argument(${this.argname}, ${this.value})`;
  }

  match(left, collected = []) {
    let l;

    const args = (() => {
      const result = [];
      for (l of Array.from(left)) {
        if (l.constructor === Argument) {
          result.push(l);
        }
      }
      return result;
    })();
    if (!args.length) {
      return [false, left, collected];
    }
    left = (() => {
      const result1 = [];
      for (l of Array.from(left)) {
        if (l.toString() !== args[0].toString()) {
          result1.push(l);
        }
      }
      return result1;
    })();
    if (this.value === null || this.value.constructor !== Array) {
      collected = collected.concat([new Argument(this.name(), args[0].value)]);
      return [true, left, collected];
    }
    const same_name = (() => {
      const result2 = [];
      for (const a of Array.from(collected)) {
        if (a.constructor === Argument && a.name() === this.name()) {
          result2.push(a);
        }
      }
      return result2;
    })();
    if (same_name.length > 0) {
      same_name[0].value.push(args[0].value);
      return [true, left, collected];
    }
    collected = collected.concat([
      new Argument(this.name(), [args[0].value]),
    ]);
    return [true, left, collected];
  }
}

class Command extends Pattern {
  constructor(cmdname, value = false) {
    super();
    this.cmdname = cmdname;
    this.value = value;
  }

  name() {
    return this.cmdname;
  }

  toString() {
    return `Command(${this.cmdname}, ${this.value})`;
  }

  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    const args = Array.from(left).filter(l => l.constructor === Argument);
    if (!args.length || args[0].value !== this.name()) {
      return [false, left, collected];
    }
    left.splice(left.indexOf(args[0]), 1);
    collected.push(new Command(this.name(), true));
    return [true, left, collected];
  }
}

class Option extends Pattern {
  constructor(short = null, long = null, argcount = 0, value = false) {
    super();
    this.short = short;
    this.long = long;
    this.argcount = argcount;
    this.value = value;
  }

  toString() {
    return `Option(${this.short}, ${this.long}, ${this.argcount}, ${this
      .value})`;
  }

  name() {
    return this.long || this.short;
  }

  static parse(description) {
    // strip whitespaces
    let _,
      left,
      options;
    description = description.replace(/^\s*|\s*$/g, '');
    // split on first occurence of 2 consecutive spaces ('  ')
    [_, options, description] = Array.from((left = description.match(/(.*?) {2}(.*)/)) != null
      ? left
      : [null, description, '']);
    // replace ',' or '=' with ' '
    options = options.replace(/,|=/g, ' ');
    // set some defaults
    let [short, long, argcount, value] = Array.from([null, null, 0, false]);
    for (const s of Array.from(options.split(/\s+/))) {
      // split on spaces
      if (s.slice(0, 2) === '--') {
        long = s;
      } else if (s[0] === '-') {
        short = s;
      } else {
        argcount = 1;
      }
    }
    if (argcount === 1) {
      const matched = /\[default:\s+(.*)\]/.exec(description);
      value = matched ? matched[1] : false;
    }
    return new Option(short, long, argcount, value);
  }

  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    const left_ = Array.from(left).filter(l =>
      l.constructor !== Option ||
        this.short !== l.short ||
        this.long !== l.long);
    return [left.join(', ') !== left_.join(', '), left_, collected];
  }
}

class AnyOptions extends Pattern {
  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    const left_ = Array.from(left).filter(l => l.constructor !== Option);
    return [left.join(', ') !== left_.join(', '), left_, collected];
  }
}

class Required extends Pattern {
  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    let l = left; // copy(left)
    let c = collected; // copy(collected)
    for (const p of Array.from(this.children)) {
      let matched;
      [matched, l, c] = Array.from(p.match(l, c));
      if (!matched) {
        return [false, left, collected];
      }
    }
    return [true, l, c];
  }
}

class Optional extends Pattern {
  match(left, collected) {
    // left = copy(left)
    if (collected == null) {
      collected = [];
    }
    for (const p of Array.from(this.children)) {
      let m;
      [m, left, collected] = Array.from(p.match(left, collected));
    }
    return [true, left, collected];
  }
}

class OneOrMore extends Pattern {
  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    let l = left; // copy(left)
    let c = collected; // copy(collected)
    let l_ = [];
    let matched = true;
    let times = 0;
    while (matched) {
      // could it be that something didn't match but changed l or c?
      [matched, l, c] = Array.from(this.children[0].match(l, c));
      times += matched ? 1 : 0;
      if (l_.join(', ') === l.join(', ')) {
        break;
      }
      l_ = l;
    } // copy(l)
    if (times >= 1) {
      return [true, l, c];
    }
    return [false, left, collected];
  }
}

class Either extends Pattern {
  match(left, collected) {
    if (collected == null) {
      collected = [];
    }
    const outcomes = [];
    for (const p of Array.from(this.children)) {
      const outcome = p.match(left, collected);
      if (outcome[0]) {
        outcomes.push(outcome);
      }
    }
    if (outcomes.length > 0) {
      outcomes.sort((a, b) => {
        if (a[1].length > b[1].length) {
          return 1;
        } else if (a[1].length < b[1].length) {
          return -1;
        }
        return 0;
      });
      return outcomes[0];
    }
    return [false, left, collected];
  }
}

// same as TokenStream in python
class TokenStream extends Array {
  constructor(source, error) {
    super();
    this.error = error;
    const stream =
      source.constructor === String
        ? source.replace(/^\s+|\s+$/, '').split(/\s+/)
        : source;
    this.stream = stream;
    this.push.apply(this, stream); // CreateListFromArrayLike called on non-object
  }

  shift() {
    return [].shift.apply(this) || null;
  }

  current() {
    return this[0] || null;
  }

  toString() {
    return this.stream.toString();
  }

  join(glue) {
    return [].join.apply(this, glue);
  }
}

const parseShorts = function (tokens, options) {
  let o;
  let raw = tokens.shift().slice(1);
  const parsed = [];
  while (raw.length > 0) {
    var value;
    let opt = (() => {
      const result = [];
      for (o of Array.from(options)) {
        if (o.short !== null && o.short[1] === raw[0]) {
          result.push(o);
        }
      }
      return result;
    })();
    if (opt.length > 1) {
      tokens.error(`-${raw[0]} is specified ambiguously ${opt.length} times`);
    }
    if (opt.length < 1) {
      if (tokens.error === DocoptExit) {
        throw new tokens.error(`-${raw[0]} is not recognized`);
      } else {
        o = new Option(`-${raw[0]}`, null);
        options.push(o);
        parsed.push(o);
        raw = raw.slice(1);
        continue;
      }
    }
    o = opt[0];
    opt = new Option(o.short, o.long, o.argcount, o.value);
    raw = raw.slice(1);
    if (opt.argcount === 0) {
      value = true;
    } else {
      if (['', null].includes(raw)) {
        if (tokens.current() === null) {
          throw new tokens.error(`-${opt.short[0]} requires argument`);
        }
        raw = tokens.shift();
      }
      [value, raw] = Array.from([raw, '']);
    }
    opt.value = value;
    parsed.push(opt);
  }
  return parsed;
};

const parseLong = function (tokens, options) {
  let left;
  let o;
  let [_, raw, value] = Array.from((left = tokens.current().match(/(.*?)=(.*)/)) != null
    ? left
    : [null, tokens.current(), '']);
  tokens.shift();
  value = value === '' ? null : value;
  let opt = (() => {
    const result = [];
    for (o of Array.from(options)) {
      if (o.long && o.long.slice(0, raw.length) === raw) {
        result.push(o);
      }
    }
    return result;
  })();
  if (opt.length > 1) {
    throw new tokens.error(`${raw} is specified ambiguously ${opt.length} times`);
  }
  if (opt.length < 1) {
    if (tokens.error === DocoptExit) {
      throw new tokens.error(`${raw} is not recognized`);
    } else {
      o = new Option(null, raw, +!!value);
      options.push(o);
      return [o];
    }
  }
  o = opt[0];
  opt = new Option(o.short, o.long, o.argcount, o.value);
  if (opt.argcount === 1) {
    if (value === null) {
      if (tokens.current() === null) {
        tokens.error(`${opt.name()} requires argument`);
      }
      value = tokens.shift();
    }
  } else if (value === !null) {
    tokens.error(`${opt.name()} must not have an argument`);
  }
  opt.value = value || true;
  return [opt];
};

const parsePattern = function (source, options) {
  const tokens = new TokenStream(
    source.replace(/([\[\]\(\)\|]|\.\.\.)/g, ' $1 '),
    DocoptLanguageError,
  );
  const result = parse_expr(tokens, options);
  if (tokens.current() === !null) {
    throw (tokens.error(`unexpected ending: ${tokens.join(' ')}`));
  }
  return new Required(result);
};

var parse_expr = function (tokens, options) {
  // expr ::= seq , ( '|' seq )* ;
  let seq = parse_seq(tokens, options);

  if (tokens.current() !== '|') {
    return seq;
  }

  let result = seq.length > 1 ? [new Required(seq)] : seq;
  while (tokens.current() === '|') {
    tokens.shift();
    seq = parse_seq(tokens, options);
    result = result.concat(seq.length > 1 ? [new Required(seq)] : seq);
  }

  if (result.length > 1) {
    return [new Either(result)];
  }
  return result;
};

var parse_seq = function (tokens, options) {
  // seq ::= ( atom [ '...' ] )* ;

  let needle;
  let result = [];
  while (
    ((needle = tokens.current()), ![null, ']', ')', '|'].includes(needle))
  ) {
    let atom = parseAtom(tokens, options);
    if (tokens.current() === '...') {
      atom = [new OneOrMore(atom)];
      tokens.shift();
    }
    result = result.concat(atom);
  }
  return result;
};

const parseAtom = function parseAtom(tokens, options) {
  const token = tokens.current();
  let result = [];
  if (token === '(') {
    tokens.shift();

    result = [new Required(parse_expr(tokens, options))];
    if (tokens.shift() !== ')') {
      throw (tokens.error("Unmatched '('"));
    }
    return result;
  } else if (token === '[') {
    tokens.shift();
    if (tokens.current() === 'options') {
      result = [new Optional([new AnyOptions()])];
      tokens.shift();
    } else {
      result = [new Optional(parse_expr(tokens, options))];
    }
    if (tokens.shift() !== ']') {
      throw (tokens.error("Unmatched '['"));
    }
    return result;
  } else if (token.slice(0, 2) === '--') {
    if (token === '--') {
      return [new Command(tokens.shift())];
    }
    return parseLong(tokens, options);
  } else if (token[0] === '-' && token !== '-') {
    return parseShorts(tokens, options);
  } else if (
    (token[0] === '<' && token[token.length - 1] === '>') ||
    /^[^a-z]*[A-Z]+[^a-z]*$/.test(token)
  ) {
    return [new Argument(tokens.shift())];
  }
  return [new Command(tokens.shift())];
};

const parseArgs = function parseArgs(source, options) {
  let token;
  const tokens = new TokenStream(source, DocoptExit);
  // options = options.slice(0) # shallow copy, not sure if necessary
  let opts = [];
  while ((tokens.current()) !== null) {
    token = tokens.current();
    if (token === '--') {
      // tokens.shift()
      return opts.concat((() => {
        const result = [];
        while (tokens.length) {
          result.push(new Argument(null, tokens.shift()));
        }
        return result;
      })());
    } else if (token.slice(0, 2) === '--') {
      const long = parseLong(tokens, options);
      opts = opts.concat(long);
    } else if (token[0] === '-' && token !== '-') {
      const shorts = parseShorts(tokens, options);
      opts = opts.concat(shorts);
    } else {
      opts.push(new Argument(null, tokens.shift()));
    }
  }
  return opts;
};

const parseDocOptions = doc =>
  Array.from(doc.split(/^\s*-|\n\s*-/).slice(1)).map(s =>
    Option.parse(`-${s}`));

const printableUsage = (doc, name) => {
  const usageSplit = doc.split(/(usage:)/i);
  if (usageSplit.length < 3) {
    throw new DocoptLanguageError('"usage:" (case-insensitive) not found.');
  } else if (usageSplit.length > 3) {
    throw new DocoptLanguageError('More than one "usage:" (case-insensitive).');
  }
  return usageSplit
    .slice(1)
    .join('')
    .split(/\n\s*\n/)[0]
    .replace(/^\s+|\s+$/, '');
};

const formalUsage = function (printableUsage) {
  const pu = printableUsage.split(/\s+/).slice(1); // split and drop "usage:"
  return Array.from(pu.slice(1))
    .map(s => (s === pu[0] ? '|' : s))
    .join(' ');
};

const extras = function (help, version, options, doc) {
  const opts = {};
  for (const opt of Array.from(options)) {
    if (opt.value) {
      opts[opt.name()] = true;
    }
  }
  if (help && (opts['--help'] || opts['-h'])) {
    print(doc.replace(/^\s*|\s*$/, ''));
    process.exit();
  }
  if (version && opts['--version']) {
    print(version);
    return process.exit();
  }
};

class Dict extends Object {
  constructor(pairs) {
    super();
    for (const [key, value] of Array.from(pairs)) {
      this[key] = value;
    }
  }

  toString() {
    let k;
    const atts = (() => {
      const result = [];
      for (k in this) {
        if (!['constructor', 'toString'].includes(k)) {
          result.push(k);
        }
      }
      return result;
    })();
    atts.sort();
    return (
      `{${
        (() => {
          const result1 = [];
          for (k of Array.from(atts)) {
            result1.push(`${k}: ${this[k]}`);
          }
          return result1;
        })().join(',\n ')
      }}`
    );
  }
}

const docopt = (doc, kwargs) => {
  let a;
  if (kwargs == null) {
    kwargs = {};
  }
  const allowedargs = ['argv', 'name', 'help', 'version'];
  for (const arg in kwargs) {
    if (!Array.from(allowedargs).includes(arg)) {
      throw new Error('unrecognized argument to docopt: ');
    }
  }

  let argv = kwargs.argv === undefined ? process.argv.slice(2) : kwargs.argv;
  const name = kwargs.name === undefined ? null : kwargs.name;
  const help = kwargs.help === undefined ? true : kwargs.help;
  const version = kwargs.version === undefined ? null : kwargs.version;

  const usage = printableUsage(doc, name);
  const potOptions = parseDocOptions(doc);
  const formalPattern = parsePattern(formalUsage(usage), potOptions);

  argv = parseArgs(argv, potOptions);
  extras(help, version, argv, doc);
  const [matched, left, argums] = Array.from(formalPattern.fix().match(argv));
  if (matched && left.length === 0) {
    // better message if left?
    const options = Array.from(argv).filter(opt => opt.constructor === Option);
    const potArguments = (() => {
      const result = [];
      for (a of Array.from(formalPattern.flat())) {
        if ([Argument, Command].includes(a.constructor)) {
          result.push(a);
        }
      }
      return result;
    })();
    const parameters = [].concat(potOptions, options, potArguments, argums);
    return new Dict((() => {
      const result1 = [];
      for (a of parameters) {
        result1.push([a.name(), a.value]);
      }
      return result1;
    })());
  }
  throw new DocoptExit(usage);
};

module.exports = {
  docopt,
  Option,
  Argument,
  Command,
  Required,
  AnyOptions,
  Either,
  Optional,
  Pattern,
  OneOrMore,
  TokenStream,
  Dict,
  formalUsage,
  parseDocOptions,
  parsePattern,
  parseLong,
  parseShorts,
  parseArgs,
  printableUsage,
};

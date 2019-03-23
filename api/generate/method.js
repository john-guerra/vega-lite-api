import {capitalize, error, stringValue as $, unique} from './util';

// TODO validation

export function generateMethod(schema, methodName, spec) {
  const className = capitalize(methodName),
        ext = spec.ext || {};

  let code = '';
  const emit = s => code += (s || '') + '\n';

  // -- imports --
  emit(`import {assign, copy, init, flat, get, merge, proto, set} from "./__util__";`);
  if (spec.switch) unique(spec.switch).forEach(method => {
    emit(`import {${method}} from "./${method}";`);
  });
  emit();

  // -- constructor --
  generateConstructor(emit, className, spec.set, spec.arg);

  // -- prototype --
  emit(`const prototype = proto(${className});`);
  emit();

  // -- properties --
  for (let prop in schema) {
    if (ext.hasOwnProperty(prop)) continue; // skip if extension defined
    const mod = schema[prop].type === 'array' ? '...' : '';
    generateProperty(emit, prop, prop, mod);
  }

  // -- extensions --
  for (let prop in ext) {
    if (ext[prop] == null) continue; // skip if null
    const arg = ext[prop][0],
          set = generateMutations('obj', ext[prop][1]);

    if (!arg) {
      // zero-argument generator
      generateCopy(emit, prop, set);
    }
    else if (arg.startsWith('+++')) {
      // merge object arguments
      generateMergedProperty(emit, prop, arg.slice(3), set);
    }
    else if (arg.startsWith('...')) {
      // array value from arguments
      generateProperty(emit, prop, arg.slice(3), '...', set);
    }
    else {
      // standard value argument
      generateProperty(emit, prop, arg, '', set);
    }
  }

  // -- switch --
  for (let prop in spec.switch) {
    generateSwitch(emit, prop, spec.switch[prop]);
  }

  // -- key --
  if (spec.key) {
    generateToJSON(emit, spec.key);
  }

  // export method
  emit(`export function ${methodName}(...args) {`);
  emit(`  return new ${className}(...args);`);
  emit(`}`);

  return code;
}

function generateConstructor(emit, className, set, arg) {
  emit(`function ${className}(...args) {`);

  // init data object
  emit(`  init(this);`);

  // handle set values
  for (let prop in set) {
    emit(`  set(this, ${$(prop)}, ${$(set[prop])});`);
  }

  // handle argument values
  if (Array.isArray(arg)) {
    // use provided argument definitions
    for (let i=0, n=arg.length; i<n; ++i) {
      const _ = arg[i];
      if (Array.isArray(_)) { // include a default value
        emit(`  set(this, ${$(_[0])}, args[${i}] !== undefined ? args[${i}] : ${_[1]});`);
      } else if (_.startsWith('+++')) { // merge object arguments
        if (i !== 0) error('Illegal argument definition.');
        emit(`  set(this, ${$(_.slice(3))}, merge(get(this, ${$(_.slice(3))}), args));`);
        break;
      } else if (_.startsWith('...')) { // array value from arguments
        if (i !== 0) error('Illegal argument definition.');
        emit(`  set(this, ${$(_.slice(3))}, args);`);
        break;
      } else { // set value if not undefined
        emit(`  if (args[${i}] !== undefined) set(this, ${$(_)}, args[${i}]);`);
      }
    }
  } else {
    // otherwise, accept property value objects
    emit(`  assign(this, ...args);`);
  }

  emit(`}`);
  emit();
}

function generateMutations(obj, values) {
  let code = [];
  for (let prop in values) {
    code.push(`set(${obj}, ${$(prop)}, ${$(values[prop])});`);
  }
  return code;
}

function generateCopy(emit, method, set) {
  emit(`prototype.${method} = function() {`);
  emit(`  const obj = copy(this);`);
  if (set) set.forEach(v => emit('  ' + v));
  emit(`  return obj;`);
  emit(`};`);
  emit();
}

function generateProperty(emit, method, prop, mod, set) {
  emit(`prototype.${method} = function(${mod || ''}value) {`);
  emit(`  if (arguments.length) {`);
  emit(`    const obj = copy(this);`);
  emit(`    set(obj, ${$(prop)}, ${mod ? 'flat(value)' : 'value'});`);
  if (set) set.forEach(v => emit('    ' + v));
  emit(`    return obj;`);
  emit(`  } else {`);
  emit(`    return get(this, ${$(prop)});`);
  emit(`  }`);
  emit(`};`);
  emit();
}

function generateMergedProperty(emit, method, prop, set) {
  emit(`prototype.${method} = function(...values) {`);
  emit(`  if (arguments.length) {`);
  emit(`    const obj = copy(this);`);
  emit(`    set(obj, ${$(prop)}, merge(values));`);
  if (set) set.forEach(v => emit('    ' + v));
  emit(`    return obj;`);
  emit(`  } else {`);
  emit(`    return get(this, ${$(prop)});`);
  emit(`  }`);
  emit(`};`);
  emit();
}

function generateSwitch(emit, method, prop) {
  emit(`prototype.${method} = function(...values) {`);
  emit(`  return arguments.length`);
  emit(`    ? assign(${prop}(...values), this)`);
  emit(`    : null;`);
  emit(`};`);
  emit();
}

function generateToJSON(emit, key) {
  emit(`prototype.toJSON = function() {`);
  emit(`  return {${key}: proto().toJSON.call(this)};`);
  emit(`};`);
  emit();
}
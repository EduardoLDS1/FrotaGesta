module.exports = placa => typeof placa === 'string' && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa);

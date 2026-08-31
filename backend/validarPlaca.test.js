const validarPlaca = require('./validarPlaca');

describe('validarPlaca', () => {
    test('aceita placa no formato antigo', () => {
        expect(validarPlaca('ABC1234')).toBe(true);
    });

    test('aceita placa Mercosul', () => {
        expect(validarPlaca('ABC1D23')).toBe(true);
    });

    test('aceita placa com hifen', () => {
        expect(validarPlaca('ABC-1234')).toBe(true);
    });

    test('rejeita placa invalida', () => {
        expect(validarPlaca('AB123')).toBe(false);
    });

    test('rejeita valor vazio ou nao textual', () => {
        expect(validarPlaca('')).toBe(false);
        expect(validarPlaca(null)).toBe(false);
    });
});

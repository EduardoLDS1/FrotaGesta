function validarPlaca(placa) {
    if (typeof placa !== 'string') {
        return false;
    }

    const placaFormatada = placa
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();

    const placaAntiga = /^[A-Z]{3}[0-9]{4}$/;
    const placaMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

    return placaAntiga.test(placaFormatada) || placaMercosul.test(placaFormatada);
}

module.exports = validarPlaca;

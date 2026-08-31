const fs = require('fs');
const path = require('path');

function carregarVariaveisDeAmbiente() {
    const caminhoEnv = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(caminhoEnv)) {
        return;
    }

    const conteudo = fs.readFileSync(caminhoEnv, 'utf8');

    conteudo.split(/\r?\n/).forEach((linha) => {
        const texto = linha.trim();

        if (!texto || texto.startsWith('#')) {
            return;
        }

        const indiceIgual = texto.indexOf('=');

        if (indiceIgual === -1) {
            return;
        }

        const chave = texto.slice(0, indiceIgual).trim();
        let valor = texto.slice(indiceIgual + 1).trim();

        if (
            (valor.startsWith('"') && valor.endsWith('"')) ||
            (valor.startsWith("'") && valor.endsWith("'"))
        ) {
            valor = valor.slice(1, -1);
        }

        if (process.env[chave] === undefined) {
            process.env[chave] = valor;
        }
    });
}

module.exports = carregarVariaveisDeAmbiente;

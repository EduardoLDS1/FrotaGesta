const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { exigir, texto } = require('./utils');
const pasta = path.join(__dirname, '../uploads/comprovantes');
const limite = 5 * 1024 * 1024;
const receberArquivo = require('express').raw({ type: 'application/octet-stream', limit: '5mb' });
function tipoArquivo(bytes) {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return ['application/pdf', '.pdf'];
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['image/png', '.png'];
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['image/jpeg', '.jpg'];
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return ['image/webp', '.webp'];
  return null;
}
function lerDados(req) {
  let dados;
  try { dados = JSON.parse(decodeURIComponent(req.header('x-dados') || '')); }
  catch (_) { exigir(false, 'Dados do lançamento inválidos.'); }
  exigir(dados && typeof dados === 'object' && !Array.isArray(dados), 'Dados do lançamento inválidos.');
  return dados;
}
async function salvar(req) {
  const bytes = req.body;
  exigir(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= limite,
    'Anexe um comprovante de até 5 MB (PDF, JPG, PNG ou WEBP).');
  const tipo = tipoArquivo(bytes);
  exigir(tipo, 'Formato inválido. Anexe PDF, JPG, PNG ou WEBP.');
  let nome;
  try { nome = texto(decodeURIComponent(req.header('x-nome-arquivo') || ''), 200); }
  catch (_) { exigir(false, 'Nome do comprovante inválido.'); }
  const arquivo = randomUUID() + tipo[1];
  await fs.mkdir(pasta, {recursive:true});
  await fs.writeFile(path.join(pasta, arquivo), bytes, {flag:'wx'});
  return {comprovante_arquivo: arquivo, comprovante_nome: nome, comprovante_mime: tipo[0]};
}
async function apagar(arquivo) {
  if (arquivo) await fs.unlink(path.join(pasta, arquivo)).catch(() => {});
}
async function abrir(arquivo) {
  return fs.readFile(path.join(pasta, path.basename(arquivo)));
}
module.exports = { receberArquivo, lerDados, salvar, apagar, abrir, tipoArquivo };

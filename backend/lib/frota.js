const { exigir, dinheiro, data, texto } = require('./utils');
const decimal = (v, nome, { min = 0, max = 9999999999.99, casas = 2 } = {}) => {
  const n = typeof v === 'number' || (typeof v === 'string' && v.trim()) ? Number(v) : NaN;
  exigir(Number.isFinite(n) && n >= min && n <= max &&
    Math.abs(n * 10 ** casas - Math.round(n * 10 ** casas)) < 0.001,
    `Informe ${nome} válido (até ${casas} casas decimais).`);
  return n;
};
const opcional = (v, nome, opcoes = {}) => (v === undefined || v === null || v === '' ? null : decimal(v, nome, opcoes));
const pagamento = (b) => {
  const situacao = b.situacao_aquisicao || 'Não informado';
  exigir(['Não informado','Quitado','Financiado','Locado'].includes(situacao), 'Situação de aquisição inválida.');
  const valor = dinheiro(b.valor_compra ?? 0);
  const entrada = dinheiro(b.valor_entrada ?? 0);
  const parcela = dinheiro(b.valor_parcela ?? 0);
  const total = Number(b.total_parcelas ?? 0), pagas = Number(b.parcelas_pagas ?? 0);
  exigir(Number.isInteger(total) && total >= 0 && total <= 600 && Number.isInteger(pagas) && pagas >= 0 && pagas <= total, 'Quantidade de parcelas inválida.');
  const dataCompra = b.data_aquisicao ? data(b.data_aquisicao) : null;
  exigir(!dataCompra || !Number.isNaN(Date.parse(dataCompra)), 'Data de aquisição inválida.');
  const primeiro = b.primeiro_vencimento ? data(b.primeiro_vencimento) : null;
  exigir(situacao === 'Financiado' || (!Number(entrada) && !total && !pagas), 'Entrada e contagem de parcelas são exclusivas de financiamento.');
  exigir(situacao === 'Financiado' || situacao === 'Locado' || !Number(parcela), 'Mensalidade só pode ser informada para financiamento ou locação.');
  exigir(situacao !== 'Financiado' || (Number(valor) > 0 && Number(parcela) > 0 && total > 0 && Number(entrada) <= Number(valor)), 'Preencha valor do veículo, entrada, valor da parcela e quantidade de parcelas.');
  exigir(situacao !== 'Locado' || (Number(parcela) > 0 && !!primeiro), 'Para locação, informe mensalidade e primeiro vencimento.');
  exigir(situacao !== 'Quitado' || Number(valor) > 0, 'Informe o valor de compra do veículo quitado.');
  exigir((situacao === 'Financiado' || situacao === 'Quitado') || Number(valor) === 0, 'Valor de compra só pode ser informado para veículo quitado ou financiado.');
  exigir(!Number(valor) || dataCompra, 'Informe a data da aquisição para registrar o investimento no relatório.');
  exigir(!primeiro || ['Financiado','Locado'].includes(situacao), 'Vencimento mensal válido somente para financiamento ou locação.');
  return [situacao, dataCompra, valor, entrada, parcela, total, pagas,
    texto(b.observacoes_financeiras ?? '', 500, false), primeiro];
};
module.exports = { decimal, opcional, pagamento };

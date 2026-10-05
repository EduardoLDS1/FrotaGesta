export function validarVeiculo(dados) {
  const erros = {};
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(dados.placa.trim().toUpperCase())) erros.placa = 'Use uma placa como ABC1234 ou ABC1D23.';
  for (const campo of ['marca', 'modelo']) {
    if (!dados[campo].trim() || dados[campo].trim().length > 100) erros[campo] = 'Informe de 1 a 100 caracteres.';
  }
  if (dados.ano !== '' && (!Number.isInteger(Number(dados.ano)) || Number(dados.ano) < 1900 || Number(dados.ano) > 2100)) erros.ano = 'Informe um ano entre 1900 e 2100.';
  if (dados.quilometragem.trim() === '' || !/^\d+(\.\d{1,2})?$/.test(dados.quilometragem) || Number(dados.quilometragem) > 9999999999.99) erros.quilometragem = 'Informe zero ou um valor positivo com até duas casas decimais.';
  return erros;
}
export function prepararVeiculo(dados) {
  return { placa: dados.placa.trim().toUpperCase(), marca: dados.marca.trim(), modelo: dados.modelo.trim(), ano: dados.ano === '' ? null : Number(dados.ano), quilometragem: Number(dados.quilometragem) };
}

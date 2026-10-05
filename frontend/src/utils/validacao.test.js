import { validarVeiculo, prepararVeiculo } from './validacao';
const valido = { placa: 'ABC1D23', marca: 'Ford', modelo: 'Ka', ano: '2020', quilometragem: '123.45' };
test('aceita padrão Mercosul, antigo e ano opcional', () => {
  expect(validarVeiculo(valido)).toEqual({});
  expect(validarVeiculo({ ...valido, placa: 'ABC1234', ano: '' })).toEqual({});
  expect(prepararVeiculo({ ...valido, ano: '' }).ano).toBeNull();
});
test.each(['-1', '', 'abc', '12.345', '10000000000'])('rejeita quilometragem %s', quilometragem => {
  expect(validarVeiculo({ ...valido, quilometragem }).quilometragem).toBeTruthy();
});

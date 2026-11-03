const validarPlaca = require("./validarPlaca");

test("placa válida", () => {
  expect(validarPlaca("ABC1234")).toBe(true);
});

test("placa inválida", () => {
  expect(validarPlaca("AB")).toBe(false);
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import Estoque from "./pages/Estoque";
import { api } from "./services/api";
jest.mock("./services/api", () => ({ api: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  window.scrollTo = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
});
test("tela de login segue fluxo autenticado", async () => {
  api.mockImplementation(async (path) => {
    if (path === "/auth/me")
      throw Object.assign(new Error("Sessão ausente"), { status: 401 });
    if (path === "/auth/login")
      return { id: 1, nome: "Eduardo", perfil: "Administrador" };
    if (path === "/dashboard")
      return {
        veiculos: 0,
        em_manutencao: 0,
        alertas: 0,
        atividades: [],
        produtos_baixos: [],
      };
  });
  render(<App />);
  await screen.findByRole("heading", { name: "Acesse o Sistema" });
  fireEvent.change(screen.getByLabelText(/Usuário ou E-mail/), {
    target: { value: "admin" },
  });
  fireEvent.change(screen.getByLabelText(/^Senha/), {
    target: { value: "Senha1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("Bem-vindo, Eduardo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Usuários" })).toBeInTheDocument();
});
test("operador não vê o menu de usuários", async () => {
  api.mockImplementation(async (p) =>
    p === "/auth/me"
      ? { id: 2, nome: "Operador", perfil: "Operador" }
      : {
          veiculos: 1,
          em_manutencao: 0,
          alertas: 0,
          atividades: [],
          produtos_baixos: [],
        },
  );
  render(<App />);
  await screen.findByText("Bem-vindo, Operador");
  expect(
    screen.queryByRole("button", { name: "Usuários" }),
  ).not.toBeInTheDocument();
});
const produto = {
  id: 1,
  nome: "Filtro de Óleo",
  modelo: "Tecfil",
  quantidade: 5,
  estoque_minimo: 5,
  valor_unitario: "25.00",
};
test("estoque exibe valor total e alerta com dados da API", async () => {
  api.mockImplementation(async (p) => (p === "/produtos" ? [produto] : []));
  render(<Estoque />);
  expect(await screen.findByText("Filtro de Óleo")).toBeInTheDocument();
  expect(screen.getByText("Estoque Baixo")).toBeInTheDocument();
  expect(screen.getByText(/125,00/)).toBeInTheDocument();
});
test("entrada enviada atualiza saldo na lista", async () => {
  let saldo = 5;
  api.mockImplementation(async (p, o) => {
    if (p === "/produtos/1/movimentacoes") {
      saldo += o.body.quantidade;
      return { ...produto, quantidade: saldo };
    }
    if (p === "/produtos") return [{ ...produto, quantidade: saldo }];
    return [];
  });
  render(<Estoque />);
  await screen.findByText("Filtro de Óleo");
  fireEvent.change(screen.getByLabelText(/^Produto \*/), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText(/^Quantidade \*/), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText(/^Motivo/), {
    target: { value: "Compra" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar movimentação" }),
  );
  await screen.findByText("Movimentação registrada e estoque atualizado.");
  await waitFor(() =>
    expect(screen.getByText("8 unidades")).toBeInTheDocument(),
  );
  expect(api).toHaveBeenCalledWith("/produtos/1/movimentacoes", {
    method: "POST",
    body: { tipo: "Entrada", quantidade: 3, motivo: "Compra" },
  });
});
test("saída recusada mantém os valores para correção", async () => {
  api.mockImplementation(async (p) => {
    if (p === "/produtos") return [produto];
    if (p.endsWith("/1/movimentacoes"))
      throw new Error("Estoque insuficiente.");
    return [];
  });
  render(<Estoque />);
  await screen.findByText("Filtro de Óleo");
  fireEvent.change(screen.getByLabelText(/^Produto \*/), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Tipo"), {
    target: { value: "Saída" },
  });
  fireEvent.change(screen.getByLabelText(/^Quantidade \*/), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText(/^Motivo/), {
    target: { value: "Revisão" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar movimentação" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Estoque insuficiente.",
  );
  expect(screen.getByLabelText(/^Motivo/)).toHaveValue("Revisão");
});
test("busca filtra inventário", async () => {
  api.mockImplementation(async (p) => (p === "/produtos" ? [produto] : []));
  render(<Estoque />);
  await screen.findByText("Filtro de Óleo");
  fireEvent.change(screen.getByLabelText("Buscar produtos"), {
    target: { value: "bateria" },
  });
  expect(screen.queryByText("Filtro de Óleo")).not.toBeInTheDocument();
});

import { useState, useRef } from "react";
import { api } from "../services/api";
import { useData } from "../components/useData";
import {
  Field,
  Notice,
  Table,
  Pager,
  Badge,
  Actions,
  moeda,
  numero,
  horario,
  Icon,
} from "../components/UI";
const inicial = {
  nome: "",
  modelo: "",
  quantidade: "0",
  valor_unitario: "",
  estoque_minimo: "5",
};
export default function Estoque() {
  const lista = useData("/produtos"),
    historico = useData("/produtos/movimentacoes");
  const [form, setForm] = useState(inicial),
    [edit, setEdit] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [query, setQuery] = useState(""),
    [baixo, setBaixo] = useState(false),
    [page, setPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1),
    [produtoFiltro, setProdutoFiltro] = useState("");
  const [mov, setMov] = useState({
    produto_id: "",
    tipo: "Entrada",
    quantidade: "",
    motivo: "",
  });
  const formRef = useRef(),
    movRef = useRef();
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const produtos = lista.data || [],
    filtrados = produtos.filter(
      (p) =>
        (p.nome + " " + p.modelo).toLowerCase().includes(query.toLowerCase()) &&
        (!baixo || p.quantidade <= p.estoque_minimo),
    );
  const movimentos = (historico.data || []).filter(
    (m) => !produtoFiltro || String(m.produto_id) === produtoFiltro,
  );
  async function executar(fn, mensagem) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(mensagem);
      await Promise.all([lista.reload(), historico.reload()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function salvar(e) {
    e.preventDefault();
    executar(
      async () => {
        const body = {
          nome: form.nome,
          modelo: form.modelo,
          valor_unitario: form.valor_unitario,
          estoque_minimo: Number(form.estoque_minimo),
        };
        if (!edit) body.quantidade = Number(form.quantidade);
        await api(edit ? `/produtos/${edit}` : "/produtos", {
          method: edit ? "PUT" : "POST",
          body,
        });
        setForm(inicial);
        setEdit(null);
      },
      edit ? "Produto atualizado." : "Produto cadastrado.",
    );
  }
  function editar(p) {
    setEdit(p.id);
    setForm({
      ...p,
      valor_unitario: String(p.valor_unitario),
      quantidade: String(p.quantidade),
      estoque_minimo: String(p.estoque_minimo),
    });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function excluir(p) {
    if (
      window.confirm(
        `Excluir ${p.nome}? O saldo precisa estar zerado. O histórico será preservado.`,
      )
    )
      executar(
        () => api(`/produtos/${p.id}`, { method: "DELETE" }),
        "Produto excluído.",
      );
  }
  function registrar(e) {
    e.preventDefault();
    executar(async () => {
      await api(`/produtos/${mov.produto_id}/movimentacoes`, {
        method: "POST",
        body: {
          tipo: mov.tipo,
          quantidade: Number(mov.quantidade),
          motivo: mov.motivo,
        },
      });
      setMov((s) => ({ ...s, quantidade: "", motivo: "" }));
    }, "Movimentação registrada e estoque atualizado.");
  }
  const escolhido = produtos.find((p) => String(p.id) === mov.produto_id);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Controle de Estoque de Peças</h1>
          <p>Cadastre produtos e acompanhe as entradas e saídas.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            lista.reload();
            historico.reload();
          }}
          disabled={busy || lista.loading}
        >
          Atualizar
        </button>
      </div>
      <Notice
        error={error || lista.error || historico.error}
        success={success}
      />
      <section className="panel" ref={formRef}>
        <h2>
          <Icon name="stock" />
          {edit ? "Editar Produto" : "Cadastro de Produtos"}
        </h2>
        <form onSubmit={salvar}>
          <fieldset disabled={busy}>
            <div className="form-grid four">
              <Field
                label="Nome do Item"
                name="nome"
                value={form.nome}
                onChange={change}
                placeholder="Ex.: Filtro de Óleo"
                required
                maxLength={120}
              />
              <Field
                label="Modelo"
                name="modelo"
                value={form.modelo}
                onChange={change}
                placeholder="Ex.: Tecfil PSL55"
                required
                maxLength={100}
              />
              {!edit && (
                <Field
                  label="Quantidade inicial"
                  name="quantidade"
                  value={form.quantidade}
                  onChange={change}
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1"
                  required
                />
              )}
              <Field
                label="Valor Unitário (R$)"
                name="valor_unitario"
                value={form.valor_unitario}
                onChange={change}
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                required
              />
              <Field
                label="Estoque mínimo"
                name="estoque_minimo"
                value={form.estoque_minimo}
                onChange={change}
                type="number"
                min="0"
                max="1000000000"
                step="1"
                required
              />
            </div>
            <div className="form-end">
              {edit && (
                <>
                  <span className="helper">
                    Para alterar a quantidade, registre uma movimentação abaixo.
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setEdit(null);
                      setForm(inicial);
                    }}
                  >
                    Cancelar
                  </button>
                </>
              )}
              <button className="button primary">
                {busy
                  ? "Salvando…"
                  : edit
                    ? "Salvar alterações"
                    : "Adicionar Item"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <h2>Inventário de Peças</h2>
        <div className="filters">
          <input
            aria-label="Buscar produtos"
            placeholder="Buscar por item ou modelo…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={baixo}
              onChange={(e) => {
                setBaixo(e.target.checked);
                setPage(1);
              }}
            />
            Somente estoque baixo
          </label>
        </div>
        {lista.loading ? (
          <p className="empty" role="status">
            Carregando estoque…
          </p>
        ) : (
          <Table
            headers={[
              "Item",
              "Modelo",
              "Quantidade",
              "Mínimo",
              "Valor Unitário",
              "Valor Total",
              "Status",
              "Ações",
            ]}
            rows={filtrados.slice((page - 1) * 10, page * 10)}
            empty="Nenhum produto cadastrado ou encontrado."
            render={(p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.modelo}</td>
                <td>{numero(p.quantidade)} unidades</td>
                <td>{numero(p.estoque_minimo)}</td>
                <td>{moeda(p.valor_unitario)}</td>
                <td>
                  {moeda(Number(p.quantidade) * Number(p.valor_unitario))}
                </td>
                <td>
                  <Badge
                    tone={p.quantidade <= p.estoque_minimo ? "red" : "green"}
                  >
                    {p.quantidade <= p.estoque_minimo ? "Estoque Baixo" : "OK"}
                  </Badge>
                </td>
                <td>
                  <Actions
                    label={p.nome}
                    edit={() => editar(p)}
                    remove={() => excluir(p)}
                    disabled={busy}
                  >
                    <button
                      className="small-button"
                      disabled={busy}
                      onClick={() => {
                        setMov((s) => ({ ...s, produto_id: String(p.id) }));
                        movRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }}
                    >
                      Movimentar
                    </button>
                  </Actions>
                </td>
              </tr>
            )}
          />
        )}
        <Pager total={filtrados.length} page={page} setPage={setPage} />
      </section>
      <section className="panel" ref={movRef}>
        <h2>Registrar Entrada ou Saída</h2>
        <form onSubmit={registrar}>
          <fieldset disabled={busy}>
            <div className="form-grid four">
              <Field
                label="Produto"
                name="produto_id"
                value={mov.produto_id}
                onChange={(k, v) => setMov((s) => ({ ...s, [k]: v }))}
                required
                options={[
                  { value: "", label: "Selecione o produto" },
                  ...produtos.map((p) => ({
                    value: String(p.id),
                    label: `${p.nome} — ${p.modelo}`,
                  })),
                ]}
              />
              <Field
                label="Tipo"
                name="tipo"
                value={mov.tipo}
                onChange={(k, v) => setMov((s) => ({ ...s, [k]: v }))}
                options={["Entrada", "Saída"].map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              <Field
                label="Quantidade"
                name="quantidade"
                value={mov.quantidade}
                onChange={(k, v) => setMov((s) => ({ ...s, [k]: v }))}
                type="number"
                min="1"
                max={
                  mov.tipo === "Saída" ? escolhido?.quantidade || 0 : 1000000000
                }
                step="1"
                required
              />
              <Field
                label="Motivo"
                name="motivo"
                value={mov.motivo}
                onChange={(k, v) => setMov((s) => ({ ...s, [k]: v }))}
                placeholder="Ex.: Compra de peças"
                required
                maxLength={500}
              />
            </div>
            <div className="form-end">
              <span className="helper">
                {escolhido
                  ? `Saldo disponível: ${numero(escolhido.quantidade)} unidades.`
                  : "Selecione um produto para consultar o saldo."}
              </span>
              <button className="button primary" disabled={!mov.produto_id}>
                {busy ? "Registrando…" : "Registrar movimentação"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <h2>Histórico de Movimentações</h2>
        <div className="filters">
          <select
            aria-label="Filtrar histórico por produto"
            value={produtoFiltro}
            onChange={(e) => {
              setProdutoFiltro(e.target.value);
              setHistoryPage(1);
            }}
          >
            <option value="">Todos os produtos, inclusive excluídos</option>
            {[
              ...new Map(
                (historico.data || []).map((m) => [m.produto_id, m]),
              ).values(),
            ].map((p) => (
              <option key={p.produto_id} value={p.produto_id}>
                {p.nome} — {p.modelo}
              </option>
            ))}
          </select>
        </div>
        <Table
          headers={[
            "Data/Hora",
            "Produto",
            "Tipo",
            "Quantidade",
            "Saldo anterior",
            "Saldo atual",
            "Motivo",
            "Usuário",
          ]}
          rows={movimentos.slice((historyPage - 1) * 10, historyPage * 10)}
          empty="Nenhuma movimentação registrada."
          render={(m) => (
            <tr key={m.id}>
              <td>{horario(m.created_at)}</td>
              <td>
                {m.nome}
                <small>{m.modelo}</small>
              </td>
              <td>
                <Badge tone={m.tipo === "Entrada" ? "green" : "red"}>
                  {m.tipo}
                </Badge>
              </td>
              <td>{numero(m.quantidade)}</td>
              <td>{numero(m.saldo_anterior)}</td>
              <td>{numero(m.saldo_posterior)}</td>
              <td className="wrap">{m.motivo}</td>
              <td>{m.usuario}</td>
            </tr>
          )}
        />
        <Pager
          total={movimentos.length}
          page={historyPage}
          setPage={setHistoryPage}
        />
      </section>
    </>
  );
}

import { useState } from "react";
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
  dia,
  Icon,
} from "../components/UI";
const inicial = () => ({
  veiculo_id: "",
  data: new Date().toLocaleDateString("sv-SE"),
  tipo: "Preventiva",
  servico: "",
  custo: "",
  mecanico: "",
  observacoes: "",
  status: "Concluída",
  produto_id: "",
  quantidade_pecas: "1",
});
export default function Manutencoes() {
  const lista = useData("/manutencoes"),
    veiculos = useData("/veiculos"),
    produtos = useData("/produtos");
  const [form, setForm] = useState(inicial),
    [edit, setEdit] = useState(null),
    [show, setShow] = useState(false),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const filtrados = (lista.data || []).filter(
    (m) =>
      m.placa.toLowerCase().includes(query.toLowerCase().replace(/-/g, "")) &&
      (!status || m.status === status),
  );
  async function salvar(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { produto_id, quantidade_pecas, ...body } = form;
      if (!edit) {
        body.produto_id = produto_id ? Number(produto_id) : null;
        body.quantidade_pecas = produto_id ? Number(quantidade_pecas) : 0;
      }
      body.veiculo_id = Number(body.veiculo_id);
      await api(edit ? `/manutencoes/${edit}` : "/manutencoes", {
        method: edit ? "PUT" : "POST",
        body,
      });
      setShow(false);
      setEdit(null);
      setForm(inicial());
      setSuccess(
        "Manutenção salva. Os indicadores e o estoque foram atualizados.",
      );
      await Promise.all([lista.reload(), veiculos.reload(), produtos.reload()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function excluir(m) {
    if (
      busy ||
      !window.confirm(
        `Excluir a manutenção #${m.id}? Se houver peças vinculadas, elas serão devolvidas ao estoque.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/manutencoes/${m.id}`, { method: "DELETE" });
      setSuccess("Manutenção excluída e peças vinculadas estornadas.");
      await Promise.all([lista.reload(), veiculos.reload(), produtos.reload()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Histórico de Manutenções por Veículo</h1>
          <p>Registre serviços e acompanhe a utilização de peças.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setForm(inicial());
            setEdit(null);
            setShow(true);
          }}
        >
          <Icon name="plus" />
          Nova Manutenção
        </button>
      </div>
      <Notice
        error={error || lista.error || veiculos.error || produtos.error}
        success={success}
      />
      {show && (
        <section className="panel">
          <h2>{edit ? "Editar Manutenção" : "Registrar Manutenção"}</h2>
          <form onSubmit={salvar}>
            <fieldset disabled={busy}>
              <div className="form-grid three">
                <Field
                  label="Veículo"
                  name="veiculo_id"
                  value={String(form.veiculo_id)}
                  onChange={change}
                  required
                  options={[
                    { value: "", label: "Selecione o veículo" },
                    ...(veiculos.data || []).map((v) => ({
                      value: String(v.id),
                      label: `${v.placa} — ${v.modelo}`,
                    })),
                  ]}
                />
                <Field
                  label="Data"
                  name="data"
                  value={form.data}
                  onChange={change}
                  type="date"
                  min="1900-01-01"
                  max="2100-12-31"
                  required
                />
                <Field
                  label="Tipo"
                  name="tipo"
                  value={form.tipo}
                  onChange={change}
                  options={["Preventiva", "Corretiva"].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
                <Field
                  label="Peças / Serviços"
                  name="servico"
                  value={form.servico}
                  onChange={change}
                  required
                  maxLength={200}
                />
                <Field
                  label="Custo total (R$)"
                  name="custo"
                  value={form.custo}
                  onChange={change}
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  required
                />
                <Field
                  label="Mecânico"
                  name="mecanico"
                  value={form.mecanico}
                  onChange={change}
                  required
                  maxLength={120}
                />
                <Field
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={change}
                  options={["Em andamento", "Concluída"].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
                {!edit && (
                  <>
                    <Field
                      label="Peça do estoque (opcional)"
                      name="produto_id"
                      value={String(form.produto_id)}
                      onChange={change}
                      options={[
                        { value: "", label: "Sem retirada de peça" },
                        ...(produtos.data || []).map((p) => ({
                          value: String(p.id),
                          label: `${p.nome} — ${p.modelo} (${p.quantidade} un.)`,
                        })),
                      ]}
                    />
                    {form.produto_id && (
                      <Field
                        label="Quantidade de peças"
                        name="quantidade_pecas"
                        value={String(form.quantidade_pecas)}
                        onChange={change}
                        type="number"
                        min="1"
                        step="1"
                        max={
                          (produtos.data || []).find(
                            (p) => String(p.id) === String(form.produto_id),
                          )?.quantidade || 0
                        }
                        required
                      />
                    )}
                  </>
                )}
                <label className="field full">
                  <span>Observações</span>
                  <textarea
                    value={form.observacoes}
                    onChange={(e) => change("observacoes", e.target.value)}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
              </div>
              <p className="helper">
                O custo total inclui peças e serviços. A retirada da peça ocorre
                ao salvar o cadastro.
                {edit ? " A edição mantém a retirada original." : ""}
              </p>
              <div className="form-end">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShow(false)}
                >
                  Cancelar
                </button>
                <button className="button primary">
                  {busy ? "Salvando…" : "Salvar manutenção"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="filters">
          <Field
            label="Buscar por Placa"
            name="busca"
            value={query}
            onChange={(_, v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Digite a placa do veículo…"
          />
          <Field
            label="Status"
            name="statusFiltro"
            value={status}
            onChange={(_, v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos" },
              ...["Em andamento", "Concluída"].map((v) => ({
                value: v,
                label: v,
              })),
            ]}
          />
          <button
            className="button secondary"
            onClick={lista.reload}
            disabled={busy || lista.loading}
          >
            Atualizar
          </button>
        </div>
        <Table
          headers={[
            "Data",
            "Veículo",
            "Tipo",
            "Peças / Serviços",
            "Custo (R$)",
            "Mecânico",
            "Observações",
            "Status",
            "Ações",
          ]}
          rows={filtrados.slice((page - 1) * 10, page * 10)}
          empty={
            lista.loading
              ? "Carregando manutenções…"
              : "Nenhuma manutenção encontrada."
          }
          render={(m) => (
            <tr key={m.id}>
              <td>{dia(m.data)}</td>
              <td>{m.placa}</td>
              <td>
                <Badge tone={m.tipo === "Corretiva" ? "red" : "green"}>
                  {m.tipo}
                </Badge>
              </td>
              <td className="wrap">
                {m.servico}
                {m.produto_nome && (
                  <small>
                    {m.quantidade_pecas} × {m.produto_nome}
                  </small>
                )}
              </td>
              <td>{moeda(m.custo)}</td>
              <td>{m.mecanico}</td>
              <td className="wrap">{m.observacoes || "—"}</td>
              <td>
                <Badge tone={m.status === "Concluída" ? "green" : "yellow"}>
                  {m.status}
                </Badge>
              </td>
              <td>
                <Actions
                  label={`manutenção ${m.id}`}
                  disabled={busy}
                  edit={() => {
                    setEdit(m.id);
                    setForm({
                      ...m,
                      data: String(m.data).slice(0, 10),
                      produto_id: m.produto_id || "",
                      custo: String(m.custo),
                    });
                    setShow(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  remove={() => excluir(m)}
                />
              </td>
            </tr>
          )}
        />
        <Pager total={filtrados.length} page={page} setPage={setPage} />
      </section>
    </>
  );
}

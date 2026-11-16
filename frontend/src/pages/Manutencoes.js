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
  itens: [],
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
      const body = {
        veiculo_id: Number(form.veiculo_id), data: form.data, tipo: form.tipo,
        servico: form.servico, custo: form.custo, mecanico: form.mecanico,
        observacoes: form.observacoes, status: form.status,
      };
      if (!edit) body.itens = form.itens.filter(i => i.produto_id).map(i => ({
        produto_id: Number(i.produto_id), quantidade: Number(i.quantidade)
      }));
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
                  label="Mão de obra / serviços (R$)"
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
                  <div className="field full">
                    <span>Peças utilizadas (opcional)</span>
                    {form.itens.map((item, index) => (
                      <div key={index} className="filters" style={{marginTop: 8}}>
                        <select aria-label={`Peça ${index + 1}`} value={item.produto_id}
                          onChange={e => setForm(f => ({...f,itens:f.itens.map((i,n)=>n===index?{...i,produto_id:e.target.value}:i)}))}>
                          <option value="">Selecione a peça</option>
                          {(produtos.data || []).map(p => <option key={p.id} value={p.id}>
                            {p.nome} — {p.modelo} (saldo {p.quantidade})
                          </option>)}
                        </select>
                        <input type="number" aria-label={`Quantidade da peça ${index + 1}`}
                          min="1" step="1" required value={item.quantidade}
                          onChange={e => setForm(f => ({...f,itens:f.itens.map((i,n)=>n===index?{...i,quantidade:e.target.value}:i)}))} />
                        <button type="button" className="button secondary" onClick={() => setForm(f => ({...f,itens:f.itens.filter((_,n)=>n!==index)}))}>
                          Remover
                        </button>
                      </div>
                    ))}
                    <button className="button secondary" type="button" onClick={() => setForm(f => ({...f,itens:[...f.itens,{produto_id:"",quantidade:"1"}]}))}>
                      Adicionar peça
                    </button>
                  </div>
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
                Informe o custo de serviços separado das peças. O valor das peças será calculado
                pelos preços cadastrados no estoque. A retirada ocorre ao salvar.
                {edit ? " As peças já retiradas ficam preservadas na edição." : ""}
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
                {(m.itens || []).map(p => (
                  <small key={p.produto_id}>{p.quantidade} × {p.nome}</small>
                ))}
              </td>
              <td>{moeda(m.custo_total ?? m.custo)}</td>
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
                      custo: String(m.custo),
                      itens: [],
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

import { useState, useRef } from "react";
import { api } from "../services/api";
import { useData } from "../components/useData";
import {
  Field,
  Password,
  Notice,
  Table,
  Pager,
  Badge,
  Actions,
  Icon,
} from "../components/UI";
const inicial = {
  nome: "",
  email: "",
  cargo: "",
  login: "",
  senha: "",
  perfil: "Operador",
  ativo: "true",
};
export default function Usuarios({ usuario }) {
  const lista = useData("/usuarios"),
    [form, setForm] = useState(inicial),
    [edit, setEdit] = useState(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [codigo, setCodigo] = useState(null);
  const ref = useRef();
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  async function executar(fn, text) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    setCodigo(null);
    try {
      const r = await fn();
      if (r?.codigo)
        setCodigo({ nome: r.nome || "usuário selecionado", valor: r.codigo });
      setSuccess(text);
      await lista.reload();
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
        const r = await api(edit ? `/usuarios/${edit}` : "/usuarios", {
          method: edit ? "PUT" : "POST",
          body: { ...form, ativo: form.ativo === "true" },
        });
        setEdit(null);
        setForm(inicial);
        return r;
      },
      edit ? "Usuário atualizado." : "Usuário cadastrado.",
    );
  }
  function editar(u) {
    setEdit(u.id);
    setForm({ ...u, senha: "", ativo: String(u.ativo) });
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Gestão de Usuários</h1>
          <p>Gerencie os usuários do sistema</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setForm(inicial);
            setEdit(null);
            ref.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <Icon name="plus" />
          Novo Usuário
        </button>
      </div>
      <Notice error={error || lista.error} success={success} />
      {codigo && (
        <section className="recovery-box">
          <strong>Código de recuperação de {codigo.nome}</strong>
          <p>
            Entregue este código ao usuário e guarde-o. Ele é exibido apenas
            agora.
          </p>
          <code className="recovery-code">{codigo.valor}</code>
          <button className="button secondary" onClick={() => setCodigo(null)}>
            Já guardei
          </button>
        </section>
      )}
      <section className="panel" ref={ref}>
        <h2>
          <Icon name="users" />
          {edit ? "Editar Usuário" : "Cadastro de Novo Usuário"}
        </h2>
        <form onSubmit={salvar}>
          <fieldset disabled={busy}>
            <div className="form-grid three">
              <Field
                label="Nome Completo"
                name="nome"
                value={form.nome}
                onChange={change}
                required
                maxLength={120}
                placeholder="Digite o nome completo"
              />
              <Field
                label="E-mail"
                name="email"
                value={form.email}
                onChange={change}
                type="email"
                required
                maxLength={180}
                placeholder="Digite o e-mail"
              />
              <Field
                label="Cargo / Função"
                name="cargo"
                value={form.cargo}
                onChange={change}
                maxLength={100}
                placeholder="Digite o cargo ou função"
              />
              <Field
                label="Login"
                name="login"
                value={form.login}
                onChange={change}
                required
                minLength={3}
                maxLength={60}
                pattern="[A-Za-z0-9._\-]{3,60}"
                placeholder="Digite o login"
              />
              <Password
                label={edit ? "Nova senha (deixe vazia para manter)" : "Senha"}
                value={form.senha}
                onChange={(v) => change("senha", v)}
                required={!edit}
              />
              <Field
                label="Perfil de Acesso"
                name="perfil"
                value={form.perfil}
                onChange={change}
                options={["Administrador", "Operador"].map((v) => ({
                  value: v,
                  label: v,
                }))}
              />
              {edit && (
                <Field
                  label="Status"
                  name="ativo"
                  value={form.ativo}
                  onChange={change}
                  options={[
                    { value: "true", label: "Ativo" },
                    { value: "false", label: "Inativo" },
                  ]}
                />
              )}
            </div>
            <div className="form-end">
              {edit && (
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
              )}
              <button className="button primary">
                {busy
                  ? "Salvando…"
                  : edit
                    ? "Salvar alterações"
                    : "Cadastrar Usuário"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <h2>
          <Icon name="users" />
          Lista de Usuários
        </h2>
        <Table
          headers={["Nome", "E-mail", "Perfil", "Status", "Ações"]}
          rows={(lista.data || []).slice((page - 1) * 10, page * 10)}
          render={(u) => (
            <tr key={u.id}>
              <td>
                {u.nome}
                <small>{u.cargo}</small>
              </td>
              <td>
                {u.email}
                <small>{u.login}</small>
              </td>
              <td>
                <Badge tone={u.perfil === "Administrador" ? "green" : "blue"}>
                  {u.perfil}
                </Badge>
              </td>
              <td>
                <Badge tone={u.ativo ? "green" : "red"}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td>
                <Actions
                  label={u.nome}
                  disabled={busy}
                  edit={() => editar(u)}
                  remove={
                    u.id !== usuario.id
                      ? () => {
                          if (
                            window.confirm(
                              `Excluir o usuário ${u.nome}? Ele perderá acesso ao sistema.`,
                            )
                          )
                            executar(
                              () =>
                                api(`/usuarios/${u.id}`, { method: "DELETE" }),
                              "Usuário excluído.",
                            );
                        }
                      : null
                  }
                >
                  <button
                    className="small-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Gerar novo código de recuperação? O anterior será invalidado.",
                        )
                      )
                        executar(
                          () =>
                            api(`/usuarios/${u.id}/recuperacao`, {
                              method: "POST",
                              body: {},
                            }),
                          "Novo código gerado.",
                        );
                    }}
                  >
                    Recuperação
                  </button>
                </Actions>
              </td>
            </tr>
          )}
        />
        <Pager total={lista.data?.length || 0} page={page} setPage={setPage} />
      </section>
    </>
  );
}

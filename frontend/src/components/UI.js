import { useState, useEffect, useId } from "react";
export const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const numero = (v) => Number(v || 0).toLocaleString("pt-BR");
export const dia = (v) =>
  v ? String(v).slice(0, 10).split("-").reverse().join("/") : "—";
export const horario = (v) => new Date(v).toLocaleString("pt-BR");
export function Icon({ name, ...props }) {
  const paths = {
    home: "M3 10 12 3l9 7 M5 9v12h5v-7h4v7h5V9",
    route: "M4 5h6a3 3 0 0 1 0 6H7a3 3 0 0 0 0 6h10 M17 17l4-4-4-4 M17 17l4-4",
    wallet: "M3 6h17v15H3z M3 10h18 M15 15h4 M5 3h13",
    car: "M3 11h18 M5 5h14l2 6v6H3v-6l2-6 M6 14h2 M16 14h2 M5 17v3 M19 17v3",
    stock: "M3 8h18v13H3z M2 3h20v5H2z M9 12h6",
    tools:
      "m14 6 4 4 M20 3a6 6 0 0 0-8 8L3 20l1 1 9-9a6 6 0 0 0 8-8l-4 4-3-3 4-4",
    chart: "M3 3v18h18 M7 17v-5 M12 17V7 M17 17V4",
    users:
      "M15 21v-3a5 5 0 0 0-10 0v3 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M19 10v6 M16 13h6",
    logout: "M9 3H3v18h6 M8 12h13 M17 8l4 4-4 4",
    plus: "M12 5v14 M5 12h14",
    edit: "m4 16 12-12 4 4L8 20H4v-4 M14 6l4 4",
    trash: "M3 6h18 M6 6l1 15h10l1-15 M9 6V3h6v3 M10 10v7 M14 10v7",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    bell: "M5 16h14l-2-3V8a5 5 0 0 0-10 0v5l-2 3 M10 20h4",
    lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.car} />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="car" width="31" height="31" />
      </span>
      <span>
        Frota<b>Gesta</b>
      </span>
    </span>
  );
}
export function Notice({ error, success }) {
  return error ? (
    <div className="notice error" role="alert">
      {error}
    </div>
  ) : success ? (
    <div className="notice success" role="status">
      {success}
    </div>
  ) : null;
}
export function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  options,
  required = false,
  ...props
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>
        {label}
        {required ? " *" : ""}
      </span>
      {options ? (
        <select
          aria-labelledby={labelId}
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-labelledby={labelId}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
          {...props}
        />
      )}
    </label>
  );
}
export function Password({
  label = "Senha",
  value,
  onChange,
  required = true,
  minLength = 8,
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <span className="password">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          maxLength={128}
          autoComplete="new-password"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setShow(!show)}
        >
          <Icon name="eye" />
        </button>
      </span>
    </label>
  );
}
export function Badge({ children, tone = "green" }) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Empty({ children = "Nenhum registro encontrado." }) {
  return <div className="empty">{children}</div>;
}
export function Table({ headers, rows, render, empty }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(render)
          ) : (
            <tr>
              <td colSpan={headers.length}>
                <Empty>{empty}</Empty>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({ total, page, setPage, size = 10 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages, setPage]);
  return (
    <div className="pager">
      <span>
        {total
          ? `${(page - 1) * size + 1} a ${Math.min(page * size, total)} de ${total}`
          : "0 registros"}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span className="page-number">{page}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Próximo
        </button>
      </div>
    </div>
  );
}
export function Actions({ edit, remove, label, disabled = false, children }) {
  return (
    <div className="actions">
      {children}
      {edit && (
        <button
          className="icon-button blue"
          title="Editar"
          aria-label={`Editar ${label}`}
          disabled={disabled}
          onClick={edit}
        >
          <Icon name="edit" />
        </button>
      )}
      {remove && (
        <button
          className="icon-button red"
          title="Excluir"
          aria-label={`Excluir ${label}`}
          disabled={disabled}
          onClick={remove}
        >
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}

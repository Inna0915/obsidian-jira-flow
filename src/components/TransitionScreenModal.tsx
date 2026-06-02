import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type JiraFlowPlugin from "../main";
import type { JiraTransitionField, JiraAssignableUser } from "../api/jira";
import { useEscapeKey } from "../hooks/useEscapeKey";

export interface TransitionSubmitPayload {
  fields: Record<string, unknown>;
  update: Record<string, unknown>;
}

interface TransitionScreenModalProps {
  plugin: JiraFlowPlugin;
  issueKey: string;
  transitionName: string;
  toStatus: string;
  fields: Record<string, JiraTransitionField>;
  onSubmit: (payload: TransitionSubmitPayload) => void;
  onCancel: () => void;
}

const labelCls =
  "jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide";
const inputCls =
  "jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all";
// Inline overrides that defeat Obsidian theme styling on form controls
// (otherwise selects clip their text / look disabled).
const fieldStyle: React.CSSProperties = { minHeight: "44px", lineHeight: 1.5, boxSizing: "border-box" };

type FieldKind =
  | "select"
  | "multiselect"
  | "user"
  | "worklog"
  | "number"
  | "date"
  | "datetime"
  | "string"
  | "unsupported";

interface PreparedField {
  key: string;
  label: string;
  required: boolean;
  kind: FieldKind;
  field: JiraTransitionField;
}

const ARRAY_ID_ITEMS = new Set(["version", "component", "option"]);

function classifyField(key: string, field: JiraTransitionField): FieldKind {
  const type = field.schema?.type || "";
  const items = field.schema?.items || "";

  if (items === "worklog" || key === "worklog" || key === "timetracking") return "worklog";
  if (type === "array") {
    if (ARRAY_ID_ITEMS.has(items)) return "multiselect";
    if (items === "string") return "multiselect"; // free-form not handled well → treat as unsupported below
    return "unsupported";
  }
  if (type === "user") return "user";
  if (type === "resolution" || type === "priority" || type === "option" || field.allowedValues) return "select";
  if (type === "number") return "number";
  if (type === "datetime") return "datetime";
  if (type === "date") return "date";
  if (type === "string") return "string";
  return "unsupported";
}

/** Format a Date as Jira's expected worklog `started` string: 2026-06-02T12:01:00.000+0800 */
function formatJiraDateTime(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const tzh = pad(Math.floor(Math.abs(tz) / 60));
  const tzm = pad(Math.abs(tz) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${tzh}${tzm}`
  );
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ===== Shared click-to-open dropdown shell =====
// A control box styled exactly like the native <select> field, plus a panel that
// opens on click and closes on outside-click. Used by the multi-select and the
// assignee picker so all dropdowns share one look & interaction.
const FieldDropdown: React.FC<{
  display: string;
  placeholder: string;
  panel: (close: () => void) => React.ReactNode;
}> = ({ display, placeholder, panel }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="jf-relative" ref={rootRef}>
      <button
        type="button"
        className={`${inputCls} jf-flex jf-items-center jf-justify-between jf-text-left`}
        style={fieldStyle}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={display ? "" : "jf-text-[#97A0AF]"}>{display || placeholder}</span>
        <span className="jf-text-[#6B778C] jf-ml-2 jf-shrink-0">▾</span>
      </button>
      {open && (
        <div className="jf-absolute jf-z-[10] jf-mt-1 jf-w-full jf-max-h-60 jf-overflow-auto jf-rounded-lg jf-border jf-border-gray-200 jf-bg-white jf-shadow-lg">
          {panel(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

// ===== Multi-select dropdown (fixVersions / components) =====
const MultiSelectDropdown: React.FC<{
  options: Array<{ id?: string; name?: string; value?: string }>;
  selected: string[];
  placeholder: string;
  onChange: (ids: string[]) => void;
}> = ({ options, selected, placeholder, onChange }) => {
  const selectedSet = new Set(selected);
  const labelOf = (id: string) => {
    const o = options.find((x) => x.id === id);
    return o?.name || o?.value || id;
  };
  const display = selected.map(labelOf).join("、");

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <FieldDropdown
      display={display}
      placeholder={placeholder}
      panel={() => (
        <>
          {options.length === 0 && (
            <div className="jf-px-3 jf-py-2 jf-text-xs jf-text-[#6B778C]">无可选项</div>
          )}
          {options.map((o) => {
            const id = o.id || "";
            const on = selectedSet.has(id);
            return (
              <button
                key={id}
                type="button"
                className="jf-flex jf-w-full jf-items-center jf-gap-2 jf-px-3 jf-py-2 jf-text-left jf-text-sm hover:jf-bg-blue-50"
                onClick={() => toggle(id)}
              >
                <span className={`jf-w-4 jf-shrink-0 ${on ? "jf-text-blue-600" : "jf-text-transparent"}`}>✓</span>
                <span>{o.name || o.value || id}</span>
              </button>
            );
          })}
        </>
      )}
    />
  );
};

// ===== Assignee picker (search inside a dropdown) =====
const AssigneePicker: React.FC<{
  plugin: JiraFlowPlugin;
  issueKey: string;
  value: string;
  display: string;
  onChange: (name: string, display: string) => void;
}> = ({ plugin, issueKey, value, display, onChange }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JiraAssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      const users = await plugin.jiraApi.searchAssignableUsers(issueKey, query);
      setResults(users);
      setLoading(false);
    }, 250);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [query, armed, issueKey, plugin]);

  return (
    <FieldDropdown
      display={display || value}
      placeholder="输入用户名搜索…"
      panel={(close) => (
        <div onMouseDown={() => setArmed(true)}>
          <div className="jf-p-2 jf-border-b jf-border-gray-100">
            <input
              autoFocus
              className={inputCls}
              style={fieldStyle}
              value={query}
              placeholder="输入用户名搜索…"
              onChange={(e) => {
                setArmed(true);
                setQuery(e.target.value);
              }}
            />
          </div>
          {loading && <div className="jf-px-3 jf-py-2 jf-text-xs jf-text-[#6B778C]">搜索中…</div>}
          {!loading && results.length === 0 && (
            <div className="jf-px-3 jf-py-2 jf-text-xs jf-text-[#6B778C]">输入后显示匹配用户</div>
          )}
          {results.map((u) => (
            <button
              key={u.name}
              type="button"
              className="jf-flex jf-w-full jf-items-center jf-gap-2 jf-px-3 jf-py-2 jf-text-left jf-text-sm hover:jf-bg-blue-50"
              onClick={() => {
                onChange(u.name, u.displayName);
                close();
              }}
            >
              <span className="jf-font-medium">{u.displayName}</span>
              <span className="jf-text-xs jf-text-[#6B778C]">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    />
  );
};

export const TransitionScreenModal: React.FC<TransitionScreenModalProps> = ({
  plugin,
  issueKey,
  transitionName,
  toStatus,
  fields,
  onSubmit,
  onCancel,
}) => {
  useEscapeKey(plugin.app, onCancel, true);

  const prepared = useMemo<PreparedField[]>(() => {
    return Object.entries(fields).map(([key, field]) => ({
      key,
      label: field.name || key,
      required: !!field.required,
      kind: classifyField(key, field),
      field,
    }));
  }, [fields]);

  // Generic value store keyed by field key.
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [userDisplay, setUserDisplay] = useState<Record<string, string>>({});
  // Worklog widget state (single worklog field assumed).
  const [worklogTime, setWorklogTime] = useState("");
  const [worklogStarted, setWorklogStarted] = useState(toDatetimeLocalValue(new Date()));
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Pre-select required single-selects with their first allowed value for convenience.
  useEffect(() => {
    const init: Record<string, unknown> = {};
    for (const p of prepared) {
      if (p.kind === "select" && p.required && p.field.allowedValues?.length) {
        init[p.key] = p.field.allowedValues[0].id ?? "";
      }
    }
    if (Object.keys(init).length) setValues((v) => ({ ...init, ...v }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  const setVal = useCallback((key: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const handleSubmit = useCallback(() => {
    const outFields: Record<string, unknown> = {};
    const outUpdate: Record<string, unknown> = {};

    for (const p of prepared) {
      const raw = values[p.key];
      switch (p.kind) {
        case "select": {
          if (raw) outFields[p.key] = { id: String(raw) };
          else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "multiselect": {
          const arr = (raw as string[] | undefined) || [];
          const items = p.field.schema?.items || "";
          if (arr.length) {
            outFields[p.key] = items === "string" ? arr : arr.map((id) => ({ id }));
          } else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "user": {
          if (raw) outFields[p.key] = { name: String(raw) };
          else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "number": {
          if (raw !== undefined && raw !== "") outFields[p.key] = Number(raw);
          else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "date":
        case "datetime":
        case "string": {
          if (raw) outFields[p.key] = String(raw);
          else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "worklog": {
          if (worklogTime.trim()) {
            const started = formatJiraDateTime(new Date(worklogStarted));
            outUpdate.worklog = [{ add: { timeSpent: worklogTime.trim(), started } }];
          } else if (p.required) {
            setError(`请填写必填项：${p.label}`);
            return;
          }
          break;
        }
        case "unsupported":
          // Skip; if required, Jira will reject and we surface the error.
          break;
      }
    }

    if (comment.trim()) {
      outUpdate.comment = [{ add: { body: comment.trim() } }];
    }

    setError(null);
    onSubmit({ fields: outFields, update: outUpdate });
  }, [prepared, values, worklogTime, worklogStarted, comment, onSubmit]);

  const hasUnsupportedRequired = prepared.some((p) => p.kind === "unsupported" && p.required);

  return (
    <>
      <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-[10000]" onClick={onCancel} />
      <div className="jf-fixed jf-top-1/2 jf-left-1/2 -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-[10001] jf-w-full jf-max-w-2xl jf-max-h-[88vh] jf-flex jf-flex-col jf-bg-white jf-rounded-xl jf-shadow-2xl jf-border jf-border-gray-100 jf-overflow-hidden">
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100">
          <h2 className="jf-text-lg jf-font-semibold jf-text-[#172B4D] jf-m-0">{transitionName || "流转"}</h2>
          <p className="jf-text-xs jf-text-[#6B778C] jf-mt-1 jf-mb-0">
            {issueKey} → {toStatus}
          </p>
        </div>

        {/* Body */}
        <div className="jf-flex-1 jf-overflow-auto jf-px-6 jf-py-4 jf-space-y-4">
          {prepared.map((p) => {
            if (p.kind === "unsupported") {
              return (
                <div key={p.key}>
                  <label className={labelCls}>{p.label}</label>
                  <div className="jf-text-xs jf-text-[#97A0AF] jf-py-2">
                    此字段类型暂不支持{p.required ? "（必填，提交可能失败）" : "，将使用默认值"}
                  </div>
                </div>
              );
            }

            return (
              <div key={p.key}>
                <label className={labelCls}>
                  {p.label}
                  {p.required && <span className="jf-text-red-500 jf-ml-0.5">*</span>}
                </label>

                {p.kind === "select" && (
                  <select
                    className={inputCls}
                    style={fieldStyle}
                    value={(values[p.key] as string) || ""}
                    onChange={(e) => setVal(p.key, e.target.value)}
                  >
                    {!p.required && <option value="">（不设置）</option>}
                    {p.field.allowedValues?.map((av) => (
                      <option key={av.id} value={av.id}>
                        {av.name || av.value || av.id}
                      </option>
                    ))}
                  </select>
                )}

                {p.kind === "multiselect" && (
                  <MultiSelectDropdown
                    options={p.field.allowedValues || []}
                    selected={(values[p.key] as string[]) || []}
                    placeholder="点击选择…"
                    onChange={(ids) => setVal(p.key, ids)}
                  />
                )}

                {p.kind === "user" && (
                  <AssigneePicker
                    plugin={plugin}
                    issueKey={issueKey}
                    value={(values[p.key] as string) || ""}
                    display={userDisplay[p.key] || ""}
                    onChange={(name, display) => {
                      setVal(p.key, name);
                      setUserDisplay((d) => ({ ...d, [p.key]: display }));
                    }}
                  />
                )}

                {p.kind === "number" && (
                  <input
                    type="number"
                    className={inputCls}
                    style={fieldStyle}
                    value={(values[p.key] as string) ?? ""}
                    onChange={(e) => setVal(p.key, e.target.value)}
                  />
                )}

                {(p.kind === "date" || p.kind === "datetime") && (
                  <input
                    type={p.kind === "datetime" ? "datetime-local" : "date"}
                    className={inputCls}
                    style={fieldStyle}
                    value={(values[p.key] as string) || ""}
                    onChange={(e) => setVal(p.key, e.target.value)}
                  />
                )}

                {p.kind === "string" && (
                  <input
                    type="text"
                    className={inputCls}
                    style={fieldStyle}
                    value={(values[p.key] as string) || ""}
                    onChange={(e) => setVal(p.key, e.target.value)}
                  />
                )}

                {p.kind === "worklog" && (
                  <div className="jf-space-y-2">
                    <input
                      type="text"
                      className={inputCls}
                      style={fieldStyle}
                      placeholder="耗费时间，例如 3w 4d 12h"
                      value={worklogTime}
                      onChange={(e) => setWorklogTime(e.target.value)}
                    />
                    <div>
                      <label className="jf-block jf-text-[11px] jf-text-[#6B778C] jf-mb-1">开始时间</label>
                      <input
                        type="datetime-local"
                        className={inputCls}
                        style={fieldStyle}
                        value={worklogStarted}
                        onChange={(e) => setWorklogStarted(e.target.value)}
                      />
                    </div>
                    <p className="jf-text-[11px] jf-text-[#97A0AF] jf-m-0">
                      剩余估算按 Jira 默认「自动调整」。留空则不登记工时。
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Comment — always available (standard issue comment). */}
          <div>
            <label className={labelCls}>备注</label>
            <textarea
              className={inputCls}
              style={{ ...fieldStyle, minHeight: "96px", resize: "vertical" }}
              placeholder="可选，将作为评论添加到该问题"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {hasUnsupportedRequired && (
            <div className="jf-rounded-md jf-bg-amber-50 jf-border jf-border-amber-200 jf-px-3 jf-py-2 jf-text-xs jf-text-amber-700">
              该流转包含暂不支持的必填字段，提交可能被 Jira 拒绝。如失败请在 Jira 网页端操作。
            </div>
          )}

          {error && (
            <div className="jf-rounded-md jf-bg-red-50 jf-border jf-border-red-200 jf-px-3 jf-py-2 jf-text-xs jf-text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="jf-px-6 jf-py-3 jf-border-t jf-border-gray-100 jf-flex jf-justify-end jf-gap-2">
          <button
            type="button"
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-[#42526E] jf-rounded-md hover:jf-bg-gray-100"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-semibold jf-text-white jf-rounded-md jf-bg-blue-600 hover:jf-bg-blue-700"
            onClick={handleSubmit}
          >
            提交
          </button>
        </div>
      </div>
    </>
  );
};

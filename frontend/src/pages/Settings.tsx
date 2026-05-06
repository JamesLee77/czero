import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import i18n from "../lib/i18n";
import { useAccount } from "wagmi";
import { api } from "../lib/api";
import { useSession } from "../hooks/useSession";
import { shortAddress } from "../lib/format";

export default function Settings() {
  const { t } = useTranslation(["settings", "common"]);
  const { isConnected } = useAccount();
  const { me, signing, signIn, signOut, refresh, error } = useSession();
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [params] = useSearchParams();
  const verifiedFlash = params.get("emailVerified");

  useEffect(() => {
    if (me?.email) setEmailInput(me.email);
  }, [me?.email]);

  if (!isConnected) {
    return <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">{t("common:connect")}</div>;
  }

  if (!me) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t("settings:signIn.title")}</h2>
        <p className="text-sm text-neutral-400">{t("settings:signIn.description")}</p>
        <button
          onClick={() => void signIn()}
          disabled={signing}
          className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-50 transition"
        >
          {signing ? t("settings:signIn.signing") : t("settings:signIn.button")}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </section>
    );
  }

  async function subscribe() {
    setSaving(true);
    try {
      await api.subscribeEmail(emailInput);
      await refresh();
    } finally { setSaving(false); }
  }
  async function unsubscribe() {
    setSaving(true);
    try { await api.unsubscribeEmail(); await refresh(); }
    finally { setSaving(false); }
  }
  async function togglePref(key: "cliff_7d" | "cliff_1d" | "claim_ready") {
    if (!me) return;
    setSaving(true);
    try {
      await api.updateMe({ notif_prefs: { ...me.notif_prefs, [key]: !me.notif_prefs[key] } });
      await refresh();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings:title")}</h1>

      {verifiedFlash === "ok" && (
        <div className="rounded-md bg-green-900/40 border border-green-800 p-3 text-green-200 text-sm">
          {t("settings:verified")}
        </div>
      )}
      {verifiedFlash === "error" && (
        <div className="rounded-md bg-red-900/40 border border-red-800 p-3 text-red-200 text-sm">
          {t("settings:verifyError")}
        </div>
      )}

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:wallet.title")}</h2>
        <p className="text-sm">
          {t("settings:wallet.connected")}: <span className="font-mono">{shortAddress(me.address)}</span>
        </p>
        <button
          onClick={() => void signOut()}
          className="text-sm text-neutral-300 hover:text-white underline"
        >
          {t("settings:wallet.disconnect")}
        </button>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:email.title")}</h2>
        <p className="text-sm text-neutral-400">{t("settings:email.description")}</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={t("settings:email.placeholder")}
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2"
          />
          <button
            onClick={() => void subscribe()}
            disabled={saving || !emailInput}
            className="rounded-md bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 disabled:opacity-50 transition"
          >
            {t("settings:email.subscribe")}
          </button>
        </div>
        {me.email && (
          <div className="text-sm text-neutral-400 flex items-center gap-3">
            {t("settings:email.subscribed")}: <span className="font-mono">{me.email}</span>
            {me.email_verified ? (
              <span className="text-green-400">✓ {t("settings:email.verified")}</span>
            ) : (
              <span className="text-yellow-400">{t("settings:email.unverified")}</span>
            )}
            <button onClick={() => void unsubscribe()} className="ml-auto underline text-neutral-300 hover:text-white">
              {t("settings:email.remove")}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:prefs.title")}</h2>
        {(["cliff_7d", "cliff_1d", "claim_ready"] as const).map((k) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={me.notif_prefs[k]}
              onChange={() => void togglePref(k)}
              className="size-4"
              disabled={saving}
            />
            {t(`settings:prefs.${k}`)}
          </label>
        ))}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <h2 className="font-semibold">{t("settings:language.title")}</h2>
        <select
          value={me.language}
          disabled={saving}
          onChange={async (e) => {
            setSaving(true);
            try {
              await api.updateMe({ language: e.target.value });
              void i18n.changeLanguage(e.target.value);
              await refresh();
            } finally { setSaving(false); }
          }}
          className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2"
        >
          <option value="en">{t("settings:language.en")}</option>
        </select>
      </section>
    </div>
  );
}

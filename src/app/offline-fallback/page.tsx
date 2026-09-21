export default function OfflineFallback() {
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-16 pt-16 text-center">
      <p className="text-5xl" role="img" aria-label="offline">📡</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">You&apos;re offline</h1>
      <p className="text-[15px] leading-relaxed text-gray-400">
        StudyForge needs a connection to load fresh study data. Your timer and completed work are safe —
        reconnect and everything syncs from the database.
      </p>
      <a href="/today" className="inline-block rounded-2xl bg-accent px-8 py-3.5 text-base font-bold text-white">
        Retry Today
      </a>
    </div>
  );
}

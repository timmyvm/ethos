export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size }} className="tracking-[3px]" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? "text-sage-700" : "text-stone-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

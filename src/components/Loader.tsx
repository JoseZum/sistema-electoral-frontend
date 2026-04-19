export default function Loader({ fullscreen = false }: { fullscreen?: boolean }) {
  if (fullscreen) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader" />
      </div>
    );
  }
  return (
    <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="loader" />
    </div>
  );
}

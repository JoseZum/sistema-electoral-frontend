import LoginCard from '@/components/auth/LoginCard';
import LoginInfoPanel from '@/components/auth/LoginInfoPanel';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      {/* Left Column — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <LoginCard />
      </div>

      {/* Right Column — Info Panel */}
      <div
        className="w-[48%] bg-ink flex flex-col justify-center p-16 relative overflow-hidden max-lg:hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 21px), repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 21px)",
        }}
      >
        <LoginInfoPanel />
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';

export default function TokenLoginForm() {
  const [carnet, setCarnet] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Token login will be implemented in a future iteration
    console.log('Token login:', { carnet, token });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="carnet" className="text-[0.8125rem] font-semibold text-ink-soft">
          Carnet estudiantil
        </label>
        <input
          type="text"
          id="carnet"
          value={carnet}
          onChange={(e) => setCarnet(e.target.value)}
          placeholder="2024XXXXXX"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-sm font-body text-[0.9375rem] text-ink bg-surface-raised transition-all duration-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(229,57,53,0.07)] placeholder:text-muted-light"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="token" className="text-[0.8125rem] font-semibold text-ink-soft">
          Token de acceso
        </label>
        <input
          type="password"
          id="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token recibido por correo"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-sm font-body text-[0.9375rem] text-ink bg-surface-raised transition-all duration-200 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(229,57,53,0.07)] placeholder:text-muted-light"
        />
      </div>
      <button
        type="submit"
        className="w-full mt-2 px-7 py-3.5 bg-ink text-white border-none rounded-md font-body text-base font-semibold cursor-pointer transition-all duration-200 hover:bg-ink-soft hover:-translate-y-px hover:shadow-md"
      >
        Ingresar
      </button>
    </form>
  );
}

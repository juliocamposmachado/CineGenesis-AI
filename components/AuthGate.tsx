import React, { useState, useEffect } from 'react';
import { Lock, CreditCard, CheckCircle, Loader2, User, ShieldCheck } from 'lucide-react';
import { User as UserType, AuthState } from '../types';

interface AuthGateProps {
  onLogin: (user: UserType) => void;
}

// Credenciais Hardcoded (Demo)
const ADMIN_EMAILS = ['juliocamposmachado@gmail.com', 'radiotatuapefm@gmail.com'];
const ADMIN_PASS = 'Julio78451200';

const AuthGate: React.FC<AuthGateProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'SUBSCRIBE' | 'LOGIN'>('SUBSCRIBE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mercado Pago SDK Check
  const [mpReady, setMpReady] = useState(false);

  useEffect(() => {
    // Check if MP script is loaded
    // @ts-ignore
    if (window.MercadoPago) {
      setMpReady(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (ADMIN_EMAILS.includes(email) && password === ADMIN_PASS) {
        onLogin({
          email,
          isAdmin: true,
          hasActiveSubscription: true
        });
      } else {
        setError('Credenciais inválidas. Acesso negado.');
        setLoading(false);
      }
    }, 1000);
  };

  const handleSubscribe = () => {
    setLoading(true);
    // Simulação do Flow de Pagamento do Mercado Pago
    // Em produção, isso redirecionaria para o Checkout Pro ou abriria o Brick
    setTimeout(() => {
       alert("Simulação: Pagamento via Mercado Pago Aprovado!");
       onLogin({
         email: 'assinante@cliente.com',
         isAdmin: false,
         hasActiveSubscription: true
       });
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>

      <div className="relative z-10 w-full max-w-4xl bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding & Value Prop */}
        <div className="md:w-1/2 p-8 bg-gradient-to-br from-zinc-900 to-black border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-500 mb-6">
               <ShieldCheck size={32} />
               <span className="font-cinema text-xl font-bold tracking-widest">CINEGENESIS AI</span>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">
              Dê vida às suas histórias.
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Acesse a ferramenta profissional de visualização cinematográfica para a série 
              <span className="text-amber-500 font-cinema mx-1">Juliette Psicose</span>. 
              Crie cenas, edite vídeos e extraia arquétipos visuais com IA.
            </p>

            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle size={16} className="text-amber-500" />
                Geração de Vídeo Ilimitada (Veo)
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle size={16} className="text-amber-500" />
                Consistência de Personagem & Voz
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle size={16} className="text-amber-500" />
                Editor de Timeline (Beta)
              </li>
            </ul>
          </div>
          
          <div className="mt-8 pt-6 border-t border-zinc-800 text-[10px] text-zinc-600">
            Desenvolvido por Julio Campos Machado • Like Look Solutions
          </div>
        </div>

        {/* Right Side: Auth & Payment */}
        <div className="md:w-1/2 p-8 bg-zinc-950 flex flex-col justify-center">
          
          {/* Toggle Tabs */}
          <div className="flex p-1 bg-zinc-900 rounded-lg mb-8">
             <button 
               onClick={() => setMode('SUBSCRIBE')}
               className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${mode === 'SUBSCRIBE' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Assinar
             </button>
             <button 
               onClick={() => setMode('LOGIN')}
               className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${mode === 'LOGIN' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Entrar
             </button>
          </div>

          {mode === 'SUBSCRIBE' ? (
            <div className="animate-in fade-in slide-in-from-right-4">
               <div className="text-center mb-8">
                  <p className="text-zinc-400 text-sm uppercase tracking-wide mb-2">Plano Mensal Recorrente</p>
                  <div className="flex items-end justify-center gap-1">
                     <span className="text-sm text-zinc-500 font-bold mb-1">R$</span>
                     <span className="text-5xl font-bold text-white tracking-tighter">2,50</span>
                     <span className="text-zinc-500 font-medium mb-1">/mês</span>
                  </div>
               </div>

               <button 
                 onClick={handleSubscribe}
                 disabled={loading}
                 className="w-full py-4 bg-[#009EE3] hover:bg-[#008ED0] text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 group"
               >
                 {loading ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                 <span>Assinar com Mercado Pago</span>
               </button>
               
               <p className="text-center text-[10px] text-zinc-600 mt-4">
                 Pagamento processado de forma segura. Cancele quando quiser.
               </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-left-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-zinc-600" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                    placeholder="admin@cinegenesis.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-zinc-600" size={18} />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Acessar Sistema'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default AuthGate;
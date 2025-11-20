import React, { useState, useEffect } from 'react';
import { Lock, CreditCard, CheckCircle, Loader2, User, ShieldCheck, Zap, Clock, AlertTriangle, Key, ExternalLink, Facebook, Users, Mic2, Clapperboard, Sparkles, Palette, Wand2 } from 'lucide-react';
import { User as UserType } from '../types';

interface AuthGateProps {
  onLogin: (user: UserType) => void;
  onSetApiKey?: (key: string) => void;
}

// Credenciais Mercado Pago (Fornecidas pelo Usuário)
const MP_PUBLIC_KEY = 'APP_USR-7738c385-29b0-41c1-a9ee-7cacf4c35749';
const MP_ACCESS_TOKEN = 'APP_USR-8847529597252337-112002-b8fc04b196ea64fb73cf0cb2d8ae09db-29008060';
const MP_CLIENT_ID = '8847529597252337';

// Credenciais Admin
const ADMIN_EMAILS = ['juliocamposmachado@gmail.com', 'radiotatuapefm@gmail.com'];
const ADMIN_PASS = 'Julio78451200';

const AuthGate: React.FC<AuthGateProps> = ({ onLogin, onSetApiKey }) => {
  const [step, setStep] = useState<'EMAIL' | 'PASSWORD' | 'OFFER' | 'TEST_KEY'>('EMAIL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [testApiKey, setTestApiKey] = useState('');

  // Efeito visual de cronômetro para a promoção
  const [timeLeft, setTimeLeft] = useState({ m: 14, s: 59 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.s === 0) return { m: prev.m - 1, s: 59 };
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Passo 1: Verificar E-mail
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Fluxo Admin
    if (ADMIN_EMAILS.includes(email.trim().toLowerCase())) {
      setLoading(false);
      setStep('PASSWORD');
      return;
    }

    // 2. Fluxo Usuário Comum - Verificar Pagamento no Mercado Pago
    try {
      setCheckingStatus(true);
      
      // Busca pagamentos aprovados para este e-mail
      // Nota: Isso pode falhar por CORS se rodado direto no navegador sem proxy.
      const response = await fetch(`https://api.mercadopago.com/v1/payments/search?payer.email=${email}&status=approved`, {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
        }
      });

      if (!response.ok) {
         // Se falhar (CORS ou Auth), assumimos que não tem pagamento para mostrar a oferta (Fallback seguro)
         console.warn("Falha ao verificar API MP (Provável CORS ou Auth). Mostrando oferta.");
         setStep('OFFER');
         setLoading(false);
         return;
      }

      const data = await response.json();
      const hasPayment = data.results && data.results.length > 0;

      if (hasPayment) {
        onLogin({
          email,
          isAdmin: false,
          hasActiveSubscription: true
        });
      } else {
        setStep('OFFER'); // Não pagou, mostra promoção
      }

    } catch (err) {
      console.error("Erro MP:", err);
      // Em caso de erro de rede, mostramos a oferta para garantir conversão
      setStep('OFFER');
    } finally {
      setLoading(false);
      setCheckingStatus(false);
    }
  };

  // Passo 2: Login Admin
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (password === ADMIN_PASS) {
        onLogin({
          email,
          isAdmin: true,
          hasActiveSubscription: true
        });
      } else {
        setError('Senha administrativa incorreta.');
        setLoading(false);
      }
    }, 800);
  };

  // Passo 3: Checkout da Oferta
  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Criar Preferência de Pagamento
      const preferenceData = {
        items: [
          {
            title: 'CineGenesis AI - Acesso Vitalício (Promoção)',
            description: 'Acesso completo à ferramenta de criação de vídeo para Juliette Psicose.',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: 2.50
          }
        ],
        payer: {
          email: email
        },
        back_urls: {
          success: window.location.href,
          failure: window.location.href,
          pending: window.location.href
        },
        auto_return: "approved"
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceData)
      });

      if (response.ok) {
        const data = await response.json();
        // Redirecionar para o Checkout (Sandbox ou Produção)
        window.location.href = data.init_point; 
      } else {
        throw new Error("Falha ao criar link de pagamento");
      }

    } catch (err) {
      console.error(err);
      setError('Erro ao conectar com Mercado Pago (Bloqueio de Navegador/CORS). Tente novamente mais tarde.');
      setLoading(false);
    }
  };

  // Passo 4: Login com Chave Própria (Test Mode)
  const handleTestLogin = (e: React.FormEvent) => {
     e.preventDefault();
     if (!testApiKey.trim()) return;
     
     // Save Key
     localStorage.setItem('gemini_api_key', testApiKey);
     
     // Propagate Key
     if(onSetApiKey) onSetApiKey(testApiKey);

     // Login as Guest
     onLogin({
        email: 'convidado@cinegenesis.test',
        isAdmin: false,
        hasActiveSubscription: true
     });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md"></div>

      <div className="relative z-10 w-full max-w-6xl bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col md:flex-row h-auto md:h-[85vh]">
        
        {/* Lado Esquerdo: Valor & Branding (EXPANDIDO) */}
        <div className="md:w-6/12 p-8 md:p-10 bg-gradient-to-b from-zinc-900 to-black border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col relative overflow-hidden overflow-y-auto custom-scrollbar">
          {/* Background Glow */}
          <div className="absolute top-0 left-0 w-full h-full bg-amber-500/5 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-amber-500 mb-6">
               <div className="p-2 bg-amber-500/10 rounded-lg">
                 <ShieldCheck size={24} />
               </div>
               <span className="font-cinema text-lg font-bold tracking-widest text-white">CINEGENESIS AI</span>
            </div>
            
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full mb-4 animate-pulse">
                🔥 Promoção Vitalícia
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-2">
                Crie o impossível.
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                A ferramenta definitiva para visualização cinematográfica da série <a href="https://linktr.ee/juliette.psicose" target="_blank" rel="noopener noreferrer" className="text-amber-500 font-cinema hover:text-amber-400 hover:underline transition-colors">Juliette Psicose</a>.
              </p>

              <a 
                href="https://www.facebook.com/juliocamposmachado/posts/pfbid0236teP9jf3Ljs48fqj2Kizr9Zr2EaaftginAJL4qjbsWdFAHmJ9aErQ8Zont8mKdcl" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors mb-6 p-2 bg-blue-900/20 rounded-lg border border-blue-900/30 w-full justify-center"
              >
                 <Facebook size={14} />
                 Ver exemplos reais criados por Julio Campos Machado
                 <ExternalLink size={10} />
              </a>
            </div>

            {/* Grid de Recursos Detalhado */}
            <div className="grid grid-cols-1 gap-4 mb-8">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-2">Recursos Inclusos na Plataforma</h3>
              
              <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-900/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Consistência de Personagens</p>
                  <p className="text-zinc-500 text-xs leading-snug">Carregue fotos de referência e mantenha o mesmo rosto em todas as cenas.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-900/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 shrink-0">
                  <Mic2 size={20} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Direção Vocal com IA</p>
                  <p className="text-zinc-500 text-xs leading-snug">Envie áudios de exemplo ou descreva a voz. A IA sincroniza o tom e sotaque.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-900/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 shrink-0">
                  <Palette size={20} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Atmosfera & Transições</p>
                  <p className="text-zinc-500 text-xs leading-snug">Controle luz, som ambiente, Fade-In/Out e estilo cinematográfico (Noir, Drama).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-amber-900/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-amber-500 shrink-0">
                  <Wand2 size={20} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Casting Virtual</p>
                  <p className="text-zinc-500 text-xs leading-snug">Use imagens base para criar protagonistas e antagonistas únicos.</p>
                </div>
              </div>
            </div>

          </div>
          
          <div className="mt-auto pt-4 border-t border-zinc-800">
             <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Clock size={14} />
                Oferta expira em: <span className="text-red-500 font-mono font-bold">{timeLeft.m}:{timeLeft.s < 10 ? `0${timeLeft.s}` : timeLeft.s}</span>
             </div>
          </div>
        </div>

        {/* Lado Direito: Formulário Dinâmico */}
        <div className="md:w-6/12 p-8 md:p-12 bg-zinc-950 flex flex-col justify-center relative overflow-y-auto">
          
          {step === 'EMAIL' && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-bold text-white mb-2">Identificação</h2>
              <p className="text-zinc-400 text-sm mb-8">Digite seu e-mail para acessar ou verificar sua assinatura.</p>
              
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">E-mail Profissional</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-3.5 text-zinc-600" size={18} />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none transition-all placeholder-zinc-700"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-white/10"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Continuar'}
                </button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-zinc-900 flex flex-col items-center justify-center gap-4">
                  <button onClick={() => setStep('TEST_KEY')} className="text-zinc-500 hover:text-amber-500 text-xs flex items-center gap-2 transition-colors">
                     <Key size={12} /> Testar CineGenesis AI com Chave Própria
                  </button>
              </div>
            </div>
          )}

          {step === 'TEST_KEY' && (
             <div className="animate-in fade-in slide-in-from-right-4">
                <button onClick={() => setStep('EMAIL')} className="text-xs text-zinc-500 hover:text-white mb-6 flex items-center gap-1">← Voltar</button>
                <h2 className="text-2xl font-bold text-white mb-2">Modo de Teste (BYOK)</h2>
                <p className="text-zinc-400 text-sm mb-6">
                   Insira sua própria <span className="text-white font-bold">Gemini API Key</span> para testar a ferramenta gratuitamente usando sua cota pessoal.
                   <br/>Este teste funciona até sua cota da API esgotar.
                </p>
                
                <form onSubmit={handleTestLogin} className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Sua Chave de API (Google AI Studio)</label>
                      <div className="relative mt-1">
                         <Key className="absolute left-3 top-3.5 text-zinc-600" size={18} />
                         <input 
                            type="password" 
                            required
                            value={testApiKey}
                            onChange={e => setTestApiKey(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none transition-all placeholder-zinc-700"
                            placeholder="AIzaSy..."
                         />
                      </div>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-2 hover:underline">
                         Obter chave no Google AI Studio <ExternalLink size={10} />
                      </a>
                   </div>
                   <button 
                      type="submit"
                      className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-amber-900/20"
                   >
                      Acessar Studio (Modo Teste)
                   </button>
                </form>
             </div>
          )}

          {step === 'PASSWORD' && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <button onClick={() => setStep('EMAIL')} className="text-xs text-zinc-500 hover:text-white mb-6 flex items-center gap-1">← Voltar</button>
              <h2 className="text-2xl font-bold text-white mb-2">Acesso Administrativo</h2>
              <p className="text-zinc-400 text-sm mb-8">Olá, <strong>{email}</strong>. Digite sua credencial.</p>
              
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Senha Mestra</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3.5 text-zinc-600" size={18} />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-white focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-400 bg-red-950/30 p-3 rounded border border-red-900/30 flex items-center gap-2"><AlertTriangle size={12}/> {error}</p>}
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-amber-900/20"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Acessar Painel'}
                </button>
              </form>
            </div>
          )}

          {step === 'OFFER' && (
            <div className="animate-in fade-in zoom-in-95">
              <button onClick={() => setStep('EMAIL')} className="text-xs text-zinc-500 hover:text-white mb-4 flex items-center gap-1">← Trocar conta</button>
              
              <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-6 mb-6 relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 bg-amber-500 text-black text-[10px] font-bold px-6 py-2 rotate-12">99% OFF</div>
                 
                 <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Oferta Especial</h3>
                 <div className="flex items-end gap-3 mb-4">
                    <div className="text-zinc-500 text-lg line-through font-medium decoration-red-500 decoration-2">R$ 250,00</div>
                    <div className="text-4xl md:text-5xl font-bold text-white tracking-tighter">R$ 2,50</div>
                 </div>
                 <p className="text-amber-200/80 text-sm leading-snug">
                   Acesso <strong>VITALÍCIO</strong> e ilimitado a todas as ferramentas de IA do CineGenesis. 
                   Sem mensalidades. Pagamento único.
                 </p>
              </div>

              {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

              <button 
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-4 bg-[#009EE3] hover:bg-[#008ED0] text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 group"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CreditCard size={20} />}
                <span>GARANTIR ACESSO AGORA</span>
              </button>
              
              <div className="flex items-center justify-center gap-4 mt-6 opacity-60 grayscale">
                 <span className="text-[10px] text-zinc-500">Processado por</span>
                 <img src="https://logospng.org/download/mercado-pago/logo-mercado-pago-icone-1024.png" alt="Mercado Pago" className="h-5" />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AuthGate;
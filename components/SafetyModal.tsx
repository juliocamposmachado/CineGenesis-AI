import React from 'react';
import { ShieldAlert, CheckCircle } from 'lucide-react';

interface SafetyModalProps {
  onAccept: () => void;
}

const SafetyModal: React.FC<SafetyModalProps> = ({ onAccept }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 rounded-full shrink-0">
            <ShieldAlert className="text-amber-500" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-cinema font-bold text-white mb-1">Termos de Criação</h2>
            <p className="text-xs text-zinc-400 uppercase tracking-wider">Segurança Jurídica & Ética</p>
          </div>
        </div>
        
        <div className="p-6 space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            <strong className="text-white">Aviso Importante:</strong> Este sistema utiliza Inteligência Artificial para analisar traços estéticos, iluminação e atmosfera.
          </p>
          
          <ul className="space-y-3 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800">
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span>O sistema <strong>NÃO</strong> realiza reconhecimento facial de pessoas reais.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span>Os personagens gerados são <strong>FICTÍCIOS</strong>, baseados apenas em arquétipos visuais genéricos.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span>É proibido utilizar esta ferramenta para criar deepfakes ou violar direitos de imagem.</span>
            </li>
          </ul>

          <p className="text-xs text-zinc-500">
            Ao continuar, você concorda que as imagens enviadas servem apenas como referência artística para extração de estilo.
          </p>
        </div>

        <div className="p-4 bg-zinc-950 flex justify-end">
          <button 
            onClick={onAccept}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            Concordo e Aceito
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafetyModal;
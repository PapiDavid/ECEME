
import React from 'react';
import { MapPin, Phone, Mail, Shield } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-foreground text-background mt-auto relative">
      <div className="absolute top-0 left-0 w-full h-1 flex">
        <div className="h-full flex-1 bg-[#D52B1E]"></div>
        <div className="h-full flex-1 bg-[#F9E000]"></div>
        <div className="h-full flex-1 bg-[#007A33]"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          
          <div className="md:col-span-5 flex flex-col items-start space-y-6">
            <div className="flex items-center space-x-3">
               <Shield size={36} className="text-secondary" />
               <div>
                 <h3 className="text-2xl font-extrabold tracking-widest text-background leading-none">ECEME</h3>
                 <p className="text-xs text-primary font-bold tracking-widest mt-1">ESTADO MAYOR DEL EJÉRCITO</p>
               </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-sm">
              FORMANDO LÍDERES MILITARES ESTRATÉGICOS CON LOS MÁS ALTOS ESTÁNDARES DE EXCELENCIA ACADÉMICA, DISCIPLINA Y HONOR PARA EL SERVICIO DE BOLIVIA.
            </p>
          </div>

          <div className="md:col-span-4 flex flex-col items-start space-y-6">
            <h4 className="text-lg font-bold text-accent tracking-widest border-b-2 border-primary pb-2 w-full">CONTACTO INSTITUCIONAL</h4>
            <ul className="space-y-4 text-sm text-background/80 font-medium">
              <li className="flex items-start space-x-3">
                <MapPin size={18} className="text-primary shrink-0 mt-0.5" />
                <span>AV. SAAVEDRA, ZONA MIRAFLORES<br/>LA PAZ, ESTADO PLURINACIONAL DE BOLIVIA</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone size={18} className="text-primary shrink-0" />
                <span>+591 2 2223344</span>
              </li>
              <li className="flex items-center space-x-3">
                <Mail size={18} className="text-primary shrink-0" />
                <span>CONTACTO@ECEME.EDU.BO</span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 flex flex-col items-start space-y-6">
            <h4 className="text-lg font-bold text-accent tracking-widest border-b-2 border-primary pb-2 w-full">ENLACES RÁPIDOS</h4>
            <ul className="space-y-3 text-sm text-background/80 font-bold tracking-widest">
              <li><a href="#" className="hover:text-secondary transition-colors">PORTAL ACADÉMICO</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">BIBLIOTECA VIRTUAL</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">REGLAMENTOS</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">SOPORTE TÉCNICO</a></li>
            </ul>
          </div>

        </div>

        <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">
            © {new Date().getFullYear()} ESCUELA DE COMANDO Y ESTADO MAYOR DEL EJÉRCITO. TODOS LOS DERECHOS RESERVADOS.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-4 text-xs font-bold tracking-widest text-muted-foreground">
            <span className="cursor-pointer hover:text-background">TÉRMINOS</span>
            <span className="cursor-pointer hover:text-background">PRIVACIDAD</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

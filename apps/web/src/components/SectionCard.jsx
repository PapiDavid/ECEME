
import React from 'react';
import { motion } from 'framer-motion';

const SectionCard = ({ title, children, icon: Icon, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-card rounded-2xl p-8 shadow-lg border border-border hover:shadow-xl transition-all duration-300"
    >
      {Icon && (
        <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
          <Icon size={28} className="text-primary" />
        </div>
      )}
      {title && <h3 className="text-2xl font-bold mb-4 text-card-foreground">{title}</h3>}
      <div className="text-card-foreground/80">{children}</div>
    </motion.div>
  );
};

export default SectionCard;

import React, { createContext, useContext, useState } from 'react';

const RegistrationContext = createContext();

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};

export const RegistrationProvider = ({ children }) => {
  const [isInRegistrationFlow, setIsInRegistrationFlow] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);

  const startRegistration = () => {
    setIsInRegistrationFlow(true);
    setRegistrationStep(1);
  };

  const completeRegistration = () => {
    setIsInRegistrationFlow(false);
    setRegistrationStep(1);
  };

  const nextRegistrationStep = () => {
    setRegistrationStep(prev => prev + 1);
  };

  const prevRegistrationStep = () => {
    setRegistrationStep(prev => Math.max(prev - 1, 1));
  };

  return (
    <RegistrationContext.Provider
      value={{
        isInRegistrationFlow,
        registrationStep,
        startRegistration,
        completeRegistration,
        nextRegistrationStep,
        prevRegistrationStep,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
};

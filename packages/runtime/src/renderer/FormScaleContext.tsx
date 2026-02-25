import { createContext, useContext } from 'react';

export interface FormScale {
  scaleX: number;
  scaleY: number;
}

const FormScaleContext = createContext<FormScale>({ scaleX: 1, scaleY: 1 });

export const FormScaleProvider = FormScaleContext.Provider;

export function useFormScale(): FormScale {
  return useContext(FormScaleContext);
}

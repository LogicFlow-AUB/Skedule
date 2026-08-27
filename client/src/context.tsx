import { createContext, useContext } from 'react'; export const AppContext = createContext<any>(null); export const useAppContext = () => useContext(AppContext);

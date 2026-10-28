import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root=createRoot(document.getElementById('root')!);
if(import.meta.env.DEV&&new URLSearchParams(location.search).get('preview')==='documents'){
 void import('./documents/DocumentPreview').then(({default:Preview})=>root.render(<Preview/>));
}else root.render(<App />);

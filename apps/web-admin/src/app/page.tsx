// Ana sayfa yalnizca dashboard'a yonlendirir. Auth kontrolu (admin) layout'ta yapilir.
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}

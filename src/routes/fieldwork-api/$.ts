import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/fieldwork-api/$')({
 server:{handlers:{
  GET:async({request})=>{const {handleFieldworkRequest}=await import('@/lib/fieldwork/api.server');return handleFieldworkRequest(request);},
  POST:async({request})=>{const {handleFieldworkRequest}=await import('@/lib/fieldwork/api.server');return handleFieldworkRequest(request);}
 }}
});

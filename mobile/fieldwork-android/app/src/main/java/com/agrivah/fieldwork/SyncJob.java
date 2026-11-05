package com.agrivah.fieldwork;
import android.app.job.*;import android.content.*;
public final class SyncJob extends JobService {
 private volatile boolean stopped;
 static void schedule(Context c){JobScheduler s=(JobScheduler)c.getSystemService(JOB_SCHEDULER_SERVICE);s.schedule(new JobInfo.Builder(5101,new ComponentName(c,SyncJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build());}
 public boolean onStartJob(JobParameters p){stopped=false;new Thread(()->{boolean retry=false;try{Vault v=new Vault(this);Api.drain(v);String uid=new org.json.JSONObject(v.get("account","{}")).optString("id");retry=!uid.isEmpty()&&(!v.keys("out-"+uid+":").isEmpty()||!v.keys("geo-"+uid+":").isEmpty());}catch(Exception e){retry=true;}if(!stopped)jobFinished(p,retry);},"fieldwork-sync").start();return true;}
 public boolean onStopJob(JobParameters p){stopped=true;return true;}
}

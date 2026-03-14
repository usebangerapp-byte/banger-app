"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type FollowRow = { id:number|string; track_title:string|null; track_subtitle:string|null }
type ScanRow = { id:number|string; track_title:string|null; track_subtitle:string|null }
type UploadRow = { id:number|string; title:string|null; artist:string|null }

export default function ProfilePage(){

const router = useRouter()
const supabase = createSupabaseBrowser()

const [email,setEmail] = useState("")
const [follows,setFollows] = useState<FollowRow[]>([])
const [scans,setScans] = useState<ScanRow[]>([])
const [uploads,setUploads] = useState<UploadRow[]>([])

useEffect(()=>{

let mounted=true

;(async()=>{

const {data:userData}=await supabase!.auth.getUser()

const userEmail=userData.user?.email?.toLowerCase()||""
const userId=userData.user?.id||""

if(!mounted)return
setEmail(userEmail)

const {data:f}=await supabase!
.from("track_followers")
.select("id,track_title,track_subtitle")
.eq("user_id",userId)
.order("id",{ascending:false})
.limit(20)

const {data:s}=await supabase!
.from("scan_events")
.select("id,track_title,track_subtitle")
.eq("user_id",userId)
.order("id",{ascending:false})
.limit(20)

const {data:u}=await supabase!
.from("unreleased_tracks")
.select("id,title,artist,uploader_email")
.eq("uploader_email",userEmail)
.order("id",{ascending:false})
.limit(20)

if(!mounted)return

setFollows(f||[])
setScans(s||[])
setUploads(u||[])

})()


return(

<div style={trackRow}>

<div style={{flex:1,minWidth:0}}>

<div style={trackTitle}>
{title||"Untitled"}
</div>

<div style={trackArtist}>
{artist||"Unknown"}
</div>

</div>

<div style={playBtn} onClick={play}>
▶
</div>
)=>{mounted=false}

},[supabase])



async function uploadAvatar(e:any){

const file = e.target.files[0]
if(!file) return

const {data:userData}=await supabase!.auth.getUser()
const userId=userData.user?.id

await supabase!.storage
.from("avatars")
.upload(userId+".png",file,{upsert:true})

location.reload()
}


async function logout(){
await supabase!.auth.signOut()
router.replace("/login")
}


return(

<div style={trackRow}>

<div style={{flex:1,minWidth:0}}>

<div style={trackTitle}>
{title||"Untitled"}
</div>

<div style={trackArtist}>
{artist||"Unknown"}
</div>

</div>

<div style={playBtn} onClick={play}>
▶
</div>


<main style={page}>

<div style={container}>

<div style={header}>
<div style={title}>Profile</div>
<div style={emailStyle}>{email||"Connected"}</div>
</div>

<img style={avatar} src={`https://ratpqunhyulraybbmnxf.supabase.co/storage/v1/object/public/bpro_uploads/artwork/profile_${userId}.png`} />

<div style={actions}>

<label style={btn}>
Add photo
<input type="file" accept="image/*" style={{display:"none"}} onChange={uploadAvatar}/>
</label>

<button style={btn} onClick={logout}>Logout</button>
</div>

<section style={section}>
<div style={label}>FOLLOWED ID</div>
{follows.slice(0,3).map(t=>row(t.track_title,t.track_subtitle))}
</section>

<section style={section}>
<div style={label}>MY SCANS</div>
{scans.slice(0,3).map(t=>row(t.track_title,t.track_subtitle))}
</section>

<section style={section}>
<div style={label}>MY UPLOADS</div>
{uploads.slice(0,3).map(t=>row(t.title,t.artist))}
</section>

<section style={section}>
<div style={label}>ANALYTICS</div>

<div style={analytics}>

<div style={stat}>
<div style={num}>{scans.length}</div>
<div style={statLabel}>Scans</div>
</div>

<div style={stat}>
<div style={num}>{follows.length}</div>
<div style={statLabel}>Followed</div>
</div>

<div style={stat}>
<div style={num}>{uploads.length}</div>
<div style={statLabel}>Uploads</div>
</div>

</div>

</section>

</div>

</main>

)


function row(title:string|null|undefined,artist:string|null|undefined){

const [audio,setAudio] = useState<HTMLAudioElement | null>(null)

function play(){
if(audio){audio.pause()}
const a = new Audio("/preview.mp3")
a.play()
setAudio(a)
}



return(

<div style={trackRow}>

<div style={{flex:1,minWidth:0}}>

<div style={trackTitle}>
{title||"Untitled"}
</div>

<div style={trackArtist}>
{artist||"Unknown"}
</div>

</div>

<div style={playBtn} onClick={play}>
▶
</div>


<div style={trackRow}>

<div style={trackTitle}>
{title||"Untitled"}
</div>

<div style={trackArtist}>
{artist||"Unknown"}
</div>

</div>

)

}

}

const page={background:"#000",color:"#fff",minHeight:"100vh",padding:"40px 24px"} as const

const container={maxWidth:640,margin:"0 auto",display:"grid",gap:36} as const

const header={display:"grid",gap:6} as const

const title={fontSize:34,fontWeight:800} as const

const emailStyle={opacity:.6,fontSize:14} as const

const avatar={width:70,height:70,borderRadius:"50%",border:"1px solid rgba(255,255,255,.2)"} as const

const actions={display:"flex",gap:12} as const

const btn={background:"none",border:"1px solid rgba(255,255,255,.2)",color:"#fff",padding:"8px 12px",borderRadius:8,cursor:"pointer"} as const

const section={display:"grid",gap:10} as const

const label={fontSize:11,letterSpacing:"0.25em",opacity:.6} as const


const trackRow={
display:"flex",
alignItems:"center",
gap:12,
borderBottom:"1px solid rgba(255,255,255,.08)",
padding:"10px 0"
borderBottom:"1px solid rgba(255,255,255,.08)",padding:"8px 0"} as const

const trackTitle={fontWeight:600,fontSize:15} as const

const trackArtist={fontSize:13,opacity:.6} as const

const analytics={display:"flex",gap:30} as const

const stat={display:"grid"} as const

const num={fontSize:20,fontWeight:700} as const

const statLabel={fontSize:11,opacity:.6} as const


const playBtn={
fontSize:14,
cursor:"pointer",
opacity:.8
} as const

async function uploadAvatar(e:any){

const file = e.target.files?.[0]
if(!file) return

const {data:userData}=await supabase!.auth.getUser()
const userId=userData.user?.id

const path = \`artwork/profile_\${userId}.png\`

await supabase!.storage
.from("bpro_uploads")
.upload(path,file,{upsert:true})

location.reload()

}


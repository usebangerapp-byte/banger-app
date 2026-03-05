"use client"

import { useEffect, useRef, useState } from "react"

type Mode = "DJ" | "LABEL"

type Recent = {
id:number
title:string | null
artist:string | null
label:string | null
created_at:string | null
}

function timeAgo(iso:string | null){
if(!iso) return ""
const t = new Date(iso).getTime()
const s = Math.max(0,Math.floor((Date.now()-t)/1000))
if(s < 60) return s + "s ago"
const m = Math.floor(s/60)
if(m < 60) return m + "m ago"
const h = Math.floor(m/60)
if(h < 24) return h + "h ago"
const d = Math.floor(h/24)
return d + "d ago"
}

export default function BproPage(){

const inputRef = useRef<HTMLInputElement|null>(null)

const [mode,setMode] = useState<Mode>("DJ")
const [name,setName] = useState("")
const [deleteAfter,setDeleteAfter] = useState(true)

const [hover,setHover] = useState(false)
const [busy,setBusy] = useState(false)
const [step,setStep] = useState("")
const [progress,setProgress] = useState(0)

const [recent,setRecent] = useState<Recent[]>([])

async function refreshRecent(){
const r = await fetch("/api/bpro/recent",{ cache:"no-store" })
const j = await r.json().catch(()=>null)
if(j?.ok) setRecent(j.data || [])
}

useEffect(()=>{
refreshRecent()
},[])

function pickFile(){
inputRef.current?.click()
}

function setStage(label:string,p:number){
setStep(label)
setProgress(p)
}

async function upload(file:File){

setBusy(true)
setProgress(2)
setStage("Sealing session…",6)

try{

const fd = new FormData()
fd.append("file",file)
fd.append("mode",mode)
fd.append("name",name || "unknown")
fd.append("delete_after", deleteAfter ? "1" : "0")

setStage("Uploading…",22)

const r = await fetch("/api/bpro/upload",{
method:"POST",
body:fd
})

setStage("Banger is analyzing. Please hold…",58)

const j = await r.json().catch(()=>null)

if(!r.ok){
setStage("Something blocked the analysis. Retry.",0)
setBusy(false)
return
}

setStage("Finalizing…",82)

setTimeout(async ()=>{
setStage("Done. Ready to scan.",100)
setBusy(false)
await refreshRecent()
},900)

}catch{
setStage("Network error. Retry.",0)
setBusy(false)
}

}

function onDrop(e:React.DragEvent){
e.preventDefault()
setHover(false)
const f = e.dataTransfer.files?.[0]
if(f) upload(f)
}

function onPick(e:React.ChangeEvent<HTMLInputElement>){
const f = e.target.files?.[0]
if(f) upload(f)
e.target.value = ""
}

const card = (children:any)=>(
<div style={{
border:"1px solid rgba(255,255,255,0.14)",
borderRadius:"16px",
background:"rgba(255,255,255,0.03)",
padding:"14px"
}}>
{children}
</div>
)

return (
<div style={{
minHeight:"100vh",
background:"#000",
color:"#fff",
display:"flex",
flexDirection:"column",
padding:"18px",
gap:"14px"
}}>

<div style={{
display:"flex",
alignItems:"center",
justifyContent:"space-between",
gap:"12px"
}}>
<div style={{display:"flex",alignItems:"center",gap:"12px"}}>

<video
autoPlay
loop
muted
playsInline
style={{
width:"46px",
height:"46px",
borderRadius:"12px",
objectFit:"cover",
background:"rgba(255,255,255,0.06)",
border:"1px solid rgba(255,255,255,0.12)"
}}
>
<source src="/logo.webm" type="video/mp4" />
</video>

<div>
<div style={{fontWeight:900,letterSpacing:"0.14em"}}>BPRO</div>
<div style={{opacity:0.7,fontSize:"12px"}}>private recognition layer</div>
</div>

</div>

<button
type="button"
onClick={()=>window.location.href="/"}
style={{
padding:"10px 12px",
borderRadius:"999px",
border:"1px solid rgba(255,255,255,0.14)",
background:"rgba(255,255,255,0.06)",
color:"#fff",
fontSize:"12px",
cursor:"pointer"
}}
>
Scan with B
</button>
</div>

<div style={{
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:"12px"
}}>

{card(
<>
<div style={{fontSize:"12px",opacity:0.7,marginBottom:"8px"}}>Profile</div>
<div style={{display:"flex",gap:"8px"}}>
<button
type="button"
onClick={()=>setMode("DJ")}
style={{
flex:1,
padding:"10px",
borderRadius:"14px",
border:"1px solid rgba(255,255,255,0.16)",
background: mode==="DJ" ? "rgba(255,255,255,0.14)" : "transparent",
color:"#fff",
cursor:"pointer"
}}
>
DJ
</button>
<button
type="button"
onClick={()=>setMode("LABEL")}
style={{
flex:1,
padding:"10px",
borderRadius:"14px",
border:"1px solid rgba(255,255,255,0.16)",
background: mode==="LABEL" ? "rgba(255,255,255,0.14)" : "transparent",
color:"#fff",
cursor:"pointer"
}}
>
Label
</button>
</div>
</>
)}

{card(
<>
<div style={{fontSize:"12px",opacity:0.7,marginBottom:"8px"}}>
{mode==="DJ" ? "DJ alias" : "Label name"}
</div>
<input
value={name}
onChange={e=>setName(e.target.value)}
placeholder={mode==="DJ" ? "enter alias…" : "enter label…"}
style={{
width:"100%",
padding:"10px 12px",
borderRadius:"14px",
border:"1px solid rgba(255,255,255,0.16)",
background:"rgba(0,0,0,0.65)",
color:"#fff",
outline:"none"
}}
/>
</>
)}

</div>

<div
onDragOver={(e)=>{e.preventDefault();setHover(true)}}
onDragLeave={()=>setHover(false)}
onDrop={onDrop}
style={{
borderRadius:"18px",
border: hover ? "1px solid rgba(255,255,255,0.45)" : "1px dashed rgba(255,255,255,0.18)",
background: hover ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
padding:"18px",
minHeight:"290px",
position:"relative",
display:"flex",
alignItems:"center",
justifyContent:"center"
}}
>

<input
ref={inputRef}
type="file"
accept=".mp3,.wav,.mp4,audio/*,video/mp4"
onChange={onPick}
style={{display:"none"}}
/>

<button
type="button"
onClick={pickFile}
disabled={busy}
title="Add file"
style={{
position:"absolute",
top:"14px",
right:"14px",
width:"46px",
height:"46px",
borderRadius:"16px",
border:"1px solid rgba(255,255,255,0.14)",
background:"rgba(255,255,255,0.10)",
color:"#fff",
fontSize:"26px",
lineHeight:"0",
cursor:"pointer",
opacity: busy ? 0.55 : 1
}}
>
+
</button>

<div style={{textAlign:"center",maxWidth:"560px"}}>
<div style={{fontSize:"22px",fontWeight:900,letterSpacing:"0.01em"}}>
Drop to analyze
</div>

<div style={{marginTop:"10px",opacity:0.72,fontSize:"13px",lineHeight:1.55}}>
{busy ? "Banger is analyzing. Please hold…" : "Drag & drop a track, or tap + from mobile."}
</div>

<div style={{marginTop:"8px",opacity:0.55,fontSize:"12px"}}>
Indexing usually completes in 10–30 seconds.
</div>

<div style={{marginTop:"16px"}}>
<div style={{
height:"8px",
borderRadius:"999px",
background:"rgba(255,255,255,0.10)",
overflow:"hidden",
border:"1px solid rgba(255,255,255,0.10)"
}}>
<div style={{
height:"100%",
width: busy ? Math.max(6,progress) + "%" : "0%",
background:"rgba(255,255,255,0.55)",
transition:"width 280ms ease"
}}/>
</div>

<div style={{marginTop:"10px",fontSize:"12px",opacity:0.85,minHeight:"18px"}}>
{busy ? step : step ? step : "Standing by…"}
</div>
</div>

<div style={{
marginTop:"14px",
display:"flex",
justifyContent:"center",
gap:"10px",
flexWrap:"wrap"
}}>
<div style={{
padding:"8px 10px",
borderRadius:"999px",
border:"1px solid rgba(255,255,255,0.14)",
background:"rgba(255,255,255,0.04)",
fontSize:"12px",
opacity:0.9
}}>
mp3 / wav / mp4
</div>

<div style={{
display:"flex",
alignItems:"center",
gap:"8px",
padding:"8px 10px",
borderRadius:"999px",
border:"1px solid rgba(255,255,255,0.14)",
background:"rgba(255,255,255,0.04)",
fontSize:"12px",
opacity:0.95
}}>
<span style={{opacity:0.8}}>Delete after analysis</span>

<div style={{
display:"flex",
border:"1px solid rgba(255,255,255,0.14)",
borderRadius:"999px",
overflow:"hidden"
}}>
<button
type="button"
onClick={()=>setDeleteAfter(true)}
style={{
padding:"6px 10px",
border:"none",
background: deleteAfter ? "rgba(255,255,255,0.18)" : "transparent",
color:"#fff",
cursor:"pointer",
fontSize:"12px"
}}
>
ON
</button>
<button
type="button"
onClick={()=>setDeleteAfter(false)}
style={{
padding:"6px 10px",
border:"none",
background: !deleteAfter ? "rgba(255,255,255,0.18)" : "transparent",
color:"#fff",
cursor:"pointer",
fontSize:"12px"
}}
>
OFF
</button>
</div>
</div>
</div>

<div style={{marginTop:"10px",fontSize:"12px",opacity:0.62}}>
{deleteAfter
? "ON: the uploaded file is removed after analysis."
: "OFF: the uploaded file is kept for internal review."}
</div>

</div>

</div>

{card(
<>
<div style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"10px"
}}>
<div style={{fontWeight:800,letterSpacing:"0.02em"}}>Recently analyzed</div>
<button
type="button"
onClick={refreshRecent}
style={{
fontSize:"12px",
opacity:0.8,
border:"1px solid rgba(255,255,255,0.14)",
background:"rgba(255,255,255,0.05)",
color:"#fff",
padding:"8px 10px",
borderRadius:"999px",
cursor:"pointer"
}}
>
refresh
</button>
</div>

{recent.length === 0 ? (
<div style={{opacity:0.65,fontSize:"12px"}}>
No tracks yet.
</div>
) : (
<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
{recent.map((t)=>(
<div
key={t.id}
style={{
border:"1px solid rgba(255,255,255,0.10)",
borderRadius:"14px",
padding:"12px",
background:"rgba(0,0,0,0.35)",
display:"flex",
justifyContent:"space-between",
gap:"10px"
}}
>
<div style={{minWidth:0}}>
<div style={{
fontWeight:800,
whiteSpace:"nowrap",
overflow:"hidden",
textOverflow:"ellipsis"
}}>
{t.title || "Untitled"}
</div>
<div style={{fontSize:"12px",opacity:0.7}}>
{(t.label || "unknown") + " • " + (t.artist || "unknown")}
</div>
</div>

<div style={{textAlign:"right",flexShrink:0}}>
<div style={{fontSize:"12px",opacity:0.7}}>
{timeAgo(t.created_at)}
</div>
<div style={{
marginTop:"6px",
fontSize:"12px",
opacity:0.9,
border:"1px solid rgba(255,255,255,0.12)",
padding:"6px 8px",
borderRadius:"999px",
display:"inline-block"
}}>
secured
</div>
</div>

</div>
))}
</div>
)}
</>
)}

<div style={{opacity:0.55,fontSize:"12px",textAlign:"center"}}>
Play 8–15 seconds of audio, then press <b>B</b>.
</div>

</div>
)

}

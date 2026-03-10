"use client"

import { useEffect, useState } from "react"
import FollowTrackButton from "@/components/FollowTrackButton"

export default function Library() {

const [tracks,setTracks] = useState<any[]>([])

useEffect(()=>{

fetch("/api/charts")
.then(r=>r.json())
.then(d=>setTracks(d||[]))

},[])

return (

<div style={{background:"#000",minHeight:"100vh",color:"#fff",padding:"24px"}}>

<h1 style={{fontSize:"28px",marginBottom:"6px"}}>Top Unreleased</h1>
<div style={{opacity:0.6,marginBottom:"26px"}}>Most scanned unreleased tracks on Banger</div>

{tracks.map((t,i)=>(
<div key={i} style={{
background:"#0a0a0a",
border:"1px solid #111",
padding:"16px",
borderRadius:"14px",
marginBottom:"12px"
}}>

<div style={{fontWeight:600}}>{t.track_title}</div>
<div style={{opacity:0.6,fontSize:"12px"}}>{t.track_subtitle || "Unknown"}</div>

<div style={{marginTop:"6px",fontSize:"12px",color:"#00eaff"}}>
{t.scans} scans
</div>

<FollowTrackButton trackTitle={t.track_title} trackSubtitle={t.track_subtitle || ""} />

</div>
))}

</div>

)

}

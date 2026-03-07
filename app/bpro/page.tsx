
"use client"

import { useState } from "react"

export default function BproPage(){

const [ownerType,setOwnerType] = useState("label")
const [ownerName,setOwnerName] = useState("")
const [message,setMessage] = useState("")

async function upload(file:File){

const form = new FormData()

form.append("file",file)
form.append("ownerType",ownerType)
form.append("ownerName",ownerName)
form.append("keepAudio","true")

const res = await fetch("/api/bpro/upload",{method:"POST",body:form})

const data = await res.json()

if(data.ok){

setMessage("Track uploaded and fingerprint created")

}else{

setMessage("error")

}

}

function onDrop(e:any){

e.preventDefault()

const file = e.dataTransfer.files[0]

upload(file)

}

return(

<div style={{padding:40}}>

<h1>BPRO Upload</h1>

<select value={ownerType} onChange={(e)=>setOwnerType(e.target.value)}>

<option value="label">Label</option>

<option value="dj">DJ</option>

</select>

<br/><br/>

<input
placeholder="name"
value={ownerName}
onChange={(e)=>setOwnerName(e.target.value)}
/>

<br/><br/>

<div
onDragOver={(e)=>e.preventDefault()}
onDrop={onDrop}
style={{
border:"2px dashed white",
padding:80,
marginTop:20
}}
>

Drag & Drop Track

</div>

<p>{message}</p>

</div>

)

}

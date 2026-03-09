export default function LibraryPage() {

  const tracks = [
    { rank:1,title:"Unknown ID",artist:"Unreleased",scans:128 },
    { rank:2,title:"Unknown ID",artist:"Unreleased",scans:97 },
    { rank:3,title:"Unknown ID",artist:"Unreleased",scans:88 },
    { rank:4,title:"Unknown ID",artist:"Unreleased",scans:64 },
    { rank:5,title:"Unknown ID",artist:"Unreleased",scans:51 },
  ]

  return (
    <main style={{
      minHeight:"100vh",
      background:"#050507",
      color:"#fff",
      padding:"40px 22px 140px"
    }}>

      <div style={{maxWidth:720,margin:"0 auto"}}>

        <div style={{marginBottom:40}}>
          <div style={{
            fontSize:12,
            letterSpacing:"0.18em",
            opacity:0.55,
            textTransform:"uppercase"
          }}>
            Charts
          </div>

          <h1 style={{
            fontSize:38,
            margin:"10px 0",
            fontWeight:800,
            letterSpacing:"0.03em"
          }}>
            Top Unreleased
          </h1>

          <div style={{opacity:0.65}}>
            Most scanned unreleased tracks on Banger
          </div>
        </div>


        <div style={{display:"grid",gap:16}}>

          {tracks.map(track => (

            <div key={track.rank}
              style={{
                display:"grid",
                gridTemplateColumns:"60px 1fr auto",
                alignItems:"center",
                gap:16,
                padding:18,
                borderRadius:18,
                background:"linear-gradient(145deg,#0b0b0f,#0c0f14)",
                border:"1px solid rgba(0,255,255,0.08)",
                boxShadow:"0 0 25px rgba(0,255,255,0.06)"
              }}>

              <div style={{
                fontSize:18,
                fontWeight:800,
                opacity:0.9
              }}>
                #{track.rank}
              </div>

              <div>
                <div style={{fontWeight:700,fontSize:16}}>
                  {track.title}
                </div>

                <div style={{
                  fontSize:12,
                  opacity:0.5,
                  marginTop:4,
                  letterSpacing:"0.06em"
                }}>
                  UNRELEASED
                </div>
              </div>

              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700}}>
                  {track.scans}
                </div>
                <div style={{fontSize:11,opacity:0.5}}>
                  scans
                </div>
              </div>

            </div>

          ))}

        </div>

      </div>
    </main>
  )
}

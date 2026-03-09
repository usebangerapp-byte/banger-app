
const sections = [
  {
    title:"Mysterious",
    icon:"👀",
    items:["Unknown ID","Unknown ID","Unknown ID"]
  },
  {
    title:"Trending",
    icon:"🔥",
    items:["Rising Track","Rising Track","Rising Track"]
  },
  {
    title:"Recently Added",
    icon:"🆕",
    items:["New Entry","New Entry","New Entry"]
  },
  {
    title:"Most Wanted",
    icon:"⭐",
    items:["Wanted ID","Wanted ID","Wanted ID"]
  }
]

export default function ConcertsPage(){

  return(
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
            Radar
          </div>

          <h1 style={{
            fontSize:38,
            margin:"10px 0",
            fontWeight:800
          }}>
            Scene Signals
          </h1>

          <div style={{opacity:0.65}}>
            Discover what the scene is playing right now
          </div>

        </div>


        <div style={{display:"grid",gap:22}}>

          {sections.map(section => (

            <section key={section.title}
              style={{
                padding:20,
                borderRadius:20,
                background:"linear-gradient(160deg,#0b0b0f,#0c1116)",
                border:"1px solid rgba(0,255,255,0.08)",
                boxShadow:"0 0 30px rgba(0,255,255,0.05)"
              }}>

              <div style={{
                display:"flex",
                alignItems:"center",
                gap:10,
                marginBottom:14,
                fontWeight:700,
                fontSize:18
              }}>
                <span>{section.icon}</span>
                {section.title}
              </div>

              <div style={{display:"grid",gap:10}}>

                {section.items.map((item,i)=>(
                  <div key={i}
                    style={{
                      padding:"12px 14px",
                      borderRadius:14,
                      background:"rgba(255,255,255,0.04)",
                      fontSize:14,
                      opacity:0.9
                    }}>
                    {item}
                  </div>
                ))}

              </div>

            </section>

          ))}

        </div>

      </div>
    </main>
  )
}

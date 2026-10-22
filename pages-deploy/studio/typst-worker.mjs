import init,{TypstCompilerBuilder} from '/vendor/typst/compiler.mjs';
let compiler,initializing;
const layouts=new Map();
async function bytes(url){const response=await fetch(url);if(!response.ok)throw new Error('assets');return new Uint8Array(await response.arrayBuffer());}
async function initialize(){
  const response=await fetch('/vendor/typst/compiler.wasm.gz');if(!response.ok)throw new Error('assets');
  const wasm=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  await init({module_or_path:wasm});
  const builder=new TypstCompilerBuilder();builder.set_dummy_access_model();
  const fonts=await(await fetch('/vendor/typst/fonts.json')).json();
  for(const url of ['/vendor/fonts/NotoSansSC.ttf',...fonts.map(f=>'/vendor/typst/fonts/'+f)])await builder.add_raw_font(await bytes(url));
  compiler=await builder.build();
}
self.onmessage=async({data:request})=>{
  try{
    if(!initializing)initializing=initialize().catch(error=>{initializing=null;throw error;});await initializing;
    if(!layouts.has(request.template)){
      const response=await fetch('/studio/typst/'+request.template+'/layout.typ');if(!response.ok)throw new Error('assets');layouts.set(request.template,await response.text());
    }
    compiler.reset_shadow();compiler.reset();
    compiler.add_source('/layout.typ',layouts.get(request.template));compiler.add_source('/main.typ',request.source);
    compiler.map_shadow('/resume.json',new TextEncoder().encode(JSON.stringify(request.payload)));
    if(request.photo){const raw=atob(request.photo.split(',')[1]);compiler.map_shadow('/photo.png',Uint8Array.from(raw,c=>c.charCodeAt(0)));}
    const world=compiler.snapshot('/', '/main.typ', []);
    let result;try{result=world.get_artifact(1,2);}finally{world.free();}
    if(!result.result)throw new Error('compile: '+JSON.stringify(result.diagnostics));
    if(/glyph|unknown font family/i.test(JSON.stringify(result.diagnostics||[])))throw new Error('font');
    const output=result.result;self.postMessage({id:request.id,bytes:output},[output.buffer]);
  }catch(error){self.postMessage({id:request.id,error:error.message});}
};

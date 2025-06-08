const net = require("net");
const path = require("path");
const fs = require("fs");
const { gzipSync } = require('zlib');


const ENCODE_SCHEME_SUPPORTS = ['gzip']

function parseRequest(requestBuffer){
  //Splits the request into sections
   const  HTTPSections = requestBuffer.toString().split('\r\n');
   //Gets the startLine
   const startLineSection = HTTPSections[0].trim();
   //Gets the header section
   const headersSection = HTTPSections.slice(1, HTTPSections.length - 1);
   //Gets the body section
   const body = HTTPSections[HTTPSections.length - 1];   
   const headers = {};
   const startLine = startLineSection.split(' ')
   const method = startLine[0]
   const url = decodeURIComponent(startLine[1]);
   headersSection.forEach((value)=>{
             if(value){
              const index = value.indexOf(':');
              if(index !== -1){
                  const key = value.slice(0,index).trim();
                  const val = value.slice(index+1).trim();
                  headers[key] = val
              }
             }
          })
     

   return { method, url, headers, body}
}

const server = net.createServer((socket) => {
      socket.on('data',(request)=>{

         const {method, url, headers, body } = parseRequest(request);   

        //Gets the accepted encoding scheme from the response.
         const _encodingSchemes = headers['Accept-Encoding'] ? headers['Accept-Encoding'].split(/[,\s]/) : [];
         //Gets the first encoding scheme that the server supports
         const encodingScheme = _encodingSchemes.find((header)=>ENCODE_SCHEME_SUPPORTS.includes(header))

       
          if( url === '/'){
          socket.write(`HTTP/1.1 200 OK\r\nContent-Length: 0\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
          if(headers.Connection === 'close') return socket.end()
          return

          }else if(url === '/user-agent'){     

            socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length:${headers['User-Agent'].length}\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n${headers['User-Agent']}`);
            if(headers.Connection === 'close') return socket.end()
            return

          }else if(url.toLowerCase().startsWith('/files')){
            //Gets the filename from the urlstring
            const filename = path.basename(url.toString());
            //gets the directory to store the files
            const directory = process.argv[3] || path.join(__dirname,'tmp');
            const filePath = path.join(directory,`${filename}`);

            if(method === 'GET'){              
              fs.stat(filePath, (err,stats)=>{
               if(err){
                  socket.write(`HTTP/1.1 404 Not Found\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
                  if(headers.Connection === 'close') return socket.end()
                  return
               }
                 socket.write(`HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${stats.size}\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
                 fs.createReadStream(filePath)
                 .pipe(socket)
                 .on('end',()=>{
                      if(headers.Connection === 'close') return socket.end()
                 })
                 .on('error',(err)=>{
                   socket.write(`HTTP/1.1 500 Internal Server Error\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
                  if(headers.Connection === 'close') return socket.end()
                    return
                 })        
              })
              return;

            }else if(method === "POST"){

             const dirExists = fs.existsSync(directory);
             if(!dirExists){
                fs.mkdirSync(directory, {recursive:true}); 
             }

             const bodyBuffer = Buffer.from(body);

             fs.writeFile(filePath,bodyBuffer,(err)=>{
                if(err){
                   socket.write(`HTTP/1.1 500 Internal Server Error\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
                    if(headers.Connection === 'close') return socket.end()
                    return
                }
                socket.write(`HTTP/1.1 201 Created\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);
                 if(headers.Connection === 'close') return socket.end()
                return
             })
            }

             return;

          } else if(url.startsWith('/echo')){       
            if(method === 'GET'){
              const paths = url.split('/')
              let indexOfEcho = paths.findIndex(val=> val.toLowerCase() === 'echo')
              let basename = '';

              if(++indexOfEcho <= (paths.length - 1)){
                basename = paths[indexOfEcho]
              }
              if(basename){
                const compressedChunks = encodingScheme === 'gzip' ? gzipSync(basename) : basename;
                socket.write(`HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${compressedChunks.length}\r\n${encodingScheme ? `Content-Encoding: ${encodingScheme}\r\n` : ''}${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`)
                   socket.write(compressedChunks);
                
                  if(headers.Connection === 'close') return socket.end()
                  return
              }else{
                res = `HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`
                 if(headers.Connection === 'close') return socket.end()
                 
                 return
              }
            }
          }

          if(method === 'GET'){

             socket.write(`HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 0\r\n${encodingScheme ? `Content-Encoding:${encodingScheme}\r\n` : '' }${headers['Connection'] === 'close' ? 'Connection: close\r\n' : ''}\r\n`);

              if(headers.Connection === 'close') return socket.end()
              return
          }
  })
  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");

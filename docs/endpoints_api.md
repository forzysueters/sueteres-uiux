Endpoint 1:
https://reseller-prescribed-facing-dept.trycloudflare.com/get_s1
 
Exemplo de consulta usando curl:
curl.exe --ssl-no-revoke -X GET "https://reseller-prescribed-facing-dept.trycloudflare.com/get_s1" -H "accept: application/json"
Saída esperada: {"dados1":{"Velocidade":0.03,"Aceleração":0.0,"Temperatura":26}}
 
Endpoint 2:
https://reseller-prescribed-facing-dept.trycloudflare.com/get_s2
 
Exemplo de consulta usando curl:
curl.exe --ssl-no-revoke -X GET "https://reseller-prescribed-facing-dept.trycloudflare.com/get_s2" -H "accept: application/json"
Saída esperada: {"dados2":{"Velocidade":0.03,"Aceleração":0.0,"Temperatura":33}}


O endpoint operará com atualização periódica dos dados às segundas, terças e quartas, das 12h às 14h
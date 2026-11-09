import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
void (async()=>{try {const document=await db.billDocument.findFirst({where:{id:'cmw3nz6jv0001l2qkki5ju8gv',leadId:'LD-30915'},select:{publicId:true,resourceType:true,deliveryType:true,format:true,status:true}});console.log(JSON.stringify(document));} finally {await db.$disconnect();}})();

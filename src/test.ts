import { PathFinder, Parser, Organiser } from './data/data';


(async () => {
   const pathFinedr = new PathFinder();
   const parser = new Parser();
   const orgainser = new Organiser();

   const pathArray = await pathFinedr.traverse();
   await parser.parse(pathArray);
   await parser.save();
   await orgainser.transfer();
})();

// data()
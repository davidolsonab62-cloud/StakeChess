import os  
from pathlib import Path  
from dotenv import load_dotenv  
load_dotenv(Path('.') / '.env')  
p=os.environ.get('STOCKFISH_PATH')  
print('STOCKFISH_PATH=', p)  
print('exists=', os.path.exists(p) if p else False)  
from stockfish import Stockfish  
sf=Stockfish(path=p, depth=1)  
print('best=', sf.get_best_move())  

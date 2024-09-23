const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const bodyParser = require('body-parser');
//const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const formidable = require('formidable');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
//const { resourceLimits } = require('worker_threads');

// Configuração do app.
const app = express();
app.use(cors());
app.use(bodyParser.json());

// const port = 3000;
const secretWord = 'IFRN2@24';

function encriptarSenha(senha) {
  const hash = crypto.createHash('sha256');
  hash.update(senha + secretWord);
  return hash.digest('hex');
}

// Configuração e definição para armazenar fotos usando a biblioteca multer.
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads_foto/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Nomeia a imagem com o timestamp atual.
  }

});

const upload = multer({ storage: storage });

function gerarToken(payload) {
  return jwt.sign(payload, secretWord, { expiresIn: 120 });
}

function verificarToken(req, res, next) {
  if (req.headers.authorization) {
    var token = req.headers.authorization;
    token = token.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        mensagemerro:
          'Produto não autenticado. Faça login antes de chamar este recurso.',
      });
    } else {
      jwt.verify(token, secretWord, (error, decoded) => {
        if (error) {
          return res
            .status(403)
            .json({ mensagemerro: 'Token inválido. Faça login novamente.' });
        } else {
          const nome = decoded.nome;
          console.log(`Produto ${nome} autenticado com sucesso.`);
          next();
        }
      });
    }
  } else {
    return res
      .status(403)
      .json({ mensagemerro: 'Token não detectado. Faça login.' });
  }
}

// Conexão com o banco de dados MySQL.
const dbconn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'marketplacedb',
});

dbconn.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log('Conectado com sucesso ao banco de dados');
  }
});


// Validações: 

function validarNome(nome){
  return nome && nome.length >= 3; //Nome com pelo menos 3 caracteres.
}

function validarCategoria(categoria) {
  const categoriasPermitidas = ['Vestuário', 'Eletrônicos', 'Móveis'];
  return categoriasPermitidas.includes(categoria);
}

function validarSenha(senha){
  //Senha deve ter peo menos 6 caracteres e incluir números e letras.
  const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
  return regex.test(senha);
}



// Criação de rota abaixo com o método 'Post' para gerar senha como resposta no formato Json:
app.post('/gerarSenha', (req, res) => {
  const senha = req.body.senha;
  const senhaEncriptada = encriptarSenha(senha);
  res.json([senha, senhaEncriptada]);
});

// Login
app.post('/login', (req, res) => {
  const nome = req.body.nome;
  const categoria = req.body.categoria;
  const senha = encriptarSenha(req.body.senha);

  dbconn.query(
    'SELECT idProduto, nome, categoria FROM Tbproduto WHERE nome = ?  AND categoria = ? AND senha = ?',
    [nome, categoria, senha],
    (error, rows) => {
      if (error) {
        console.log('Erro ao processar o comando SQL. ', error.message);
      } else {
        if (rows.length > 0) {
          const payload = {
            id: rows[0].id,
            nome: rows[0].nome,
            categoria: rows[0].categoria,
          };
          const token = gerarToken(payload);
          res.json({ acessToken: token });
        } else {
          res.status(403).json({ mensagemerro: 'Produto ou senha inválidos' });
        }
      }
    }
  );
});

// Métodos abaixo implementados para operações do CRUD.
// GET: Retorna todos os produtos.
app.get('/produtos', (req, res) => {
  const sql = 'SELECT * FROM TbProduto';
  dbconn.query(sql, (err, result) => {
    if (err) {
    //  console.log(erro);
    res.status(500).send('Erro ao buscar produtos.');
    } else {
      res.json(result);
    }
  });
});

/*

// Get one
app.get('/produto/:id', (req, res) => {
  const idProduto = req.params.idProduto;
  const sql = 'SELECT * FROM Tbproduto WHERE id = ?';
  dbconn.query(sql, [idProduto], (erro, linhas) => {
    if (erro) {
      console.log(erro);
    } else {
      if (linhas.length > 0) {
        const produto = {
          idProduto: linhas[0].idProduto,
          nome: linhas[0].nome,
          categoria: linhas[0].email,
          preco: linhas[0].preco,
          quantidade: linhas[0].quantidade,
          senha: linhas[0].senha,
          datacriacao: linhas[0].datacriacao,
          foto: `http://localhost:3000/produto/foto${linhas[0].id}`
        }
        res.json(linhas[0]);
      } else {
        res.status(404).json({ mensagemerro: 'Registro não localizado' });
      }
    }
  });
});
*/

// GET: Retorna um produto específico pelo IdProduto.
app.get('/produtos/:id', (req, res) => {
  const { id } = req.params; //Obtém o id  da URL fornecida.

  // Query SQL para buscar o produto pelo idProduto.
  const sql = 'SELECT * FROM TbProduto WHERE idProduto = ?';

  // Exxecute a query.
  dbconn.query(sql, [id], (err, result) => {
    if (err) {
      // Se houver erro na execução da query, retorna uma resposta do erro.
      return res.status(500).send('Erro ao buscar produto.');
    }
    // Verifica se o produto existe.
    if (result.length === 0) {
      return res.status(404).send('Produto não encontrado.');
    }
    // Retorna o produto encontrado.
    res.json(result[0]); // Retorna o primeiro (e único) produto encontrado;
  });
});

// POST: Adiciona um novo produto no banco de dados MYSQL.
app.post('/produtos', upload.single('foto'), (req, res) => {
  const nome = req.body.nome;
  const categoria = req.body.categoria;
  const preco = req.body.preco;
  const quantidade = req.body.quantidade;
  const senha = encriptarSenha(req.body.senha);
  const datacricao = req.body.datacricao;
  const foto = req.file ? req.file.path: null; // Salva o caminho da foto.

  /*
  if (!foto) {
    return res.status(400).json({ mensagemerro: 'Foto é obrigatória.'});

  }
  */
  if (!validarNome(nome)) {
    console.log('O nome é válido');
    res.status(400).json({ mensagemerro: 'O nome é válido.' });
  } else {
    const sql = `INSERT INTO Tbproduto(nome, categoria, preco, quantidade, senha, datacricao, foto) VALUES (?, ?, ?, ?, ?, current_timestamp(), ?);`;
    dbconn.query(sql, [nome, categoria, preco, quantidade, senha, datacricao, foto], (erro) => {
      if (erro) {
        console.log(erro);
        res.status(400).send(erro.message);
      } else {
        res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.' });
      }
    });
  }
});

    
/*
// Update user pela photo.
app.put('/produtos/foto/:id', verificarToken, (req, res) => {
  const idProduto = req.params['id'];
  const formulario = new formidable.IncomingForm();
  formulario.parse(req, (err, fields, files) => {
    if (err) {
      next(err);
    } else {
      const caminhoOriginal = files.foto[0].filepath;
      console.log(caminhoOriginal);
      const imagem = fs.readFileSync(caminhoOriginal);
      const sql = 'UPDATE usuarios SET foto = ? WHERE id = ?';
      dbconn.query(sql, [imagem, id], (err, result) => {
        if (err) {
          res.status(400).json({
            mensagem: `Erro ao gravar mensagem. Erro: ${err.message}`,
          });
          throw err;
        } else {
          console.log('Imagem gravada com sucesso!');
          res.status(200).json({ mensagem: 'Imagem gravada com sucesso.' });
        }
      });
    }
  });
});

*/

// PUT: Atualiza um produto existente.
app.put('/produtos/:id', (req, res) => {
  const idProduto = req.params.id;
  const nome = req.body.nome;
  const categoria = req.body.categoria;
  const preco = req.body.preco;
  const quantidade = req.body.quantidade;
  const senha = encriptarSenha(req.body.senha);
  const datacricao = req.body.datacricao;
//  const foto = req.body.foto;

  if (!validarNome(nome)) {
    console.log('O nome é válido');
    res.status(400).json({ mensagemerro: 'O Nome é válido' });
  } else {
    const sql = `UPDATE Tbproduto SET nome = ?, categoria = ?, preco = ?, quantidade = ?, senha = ?, datacricao = ? WHERE idProduto = ?;`;
    dbconn.query(sql, [nome, categoria, preco, quantidade, senha, datacricao, idProduto], (erro, linhas) => {
      if (erro) {
        console.log(erro);
        res.status(400).send(erro.message);
      } else {
        if (linhas.affectedRows > 0) {
          res.status(200).json({ mensagem: 'Produto atualizado com sucesso.' });
        } else {
          res.status(404).json({ mensagemerro: 'Produto não localizado' });
        }
      }
    });
  }
});

// Método get para pegar foto.
app.get('/produtos/foto/:id', (req, res) => {
  const id = req.params['id'];
  const sql = 'SELECT foto FROM TbProduto WHERE idProduto = ?';
  dbconn.query(sql, [id], (err, result) => {
    if (err) {
      throw err;
    }

    if (result.length > 0) {
      if (result[0].foto) {
        const foto = result[0].foto;
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(foto, 'binary');
      } else {
        const fs = require('fs');
        fs.readFile('57990.jpg', function (err, data) {
          if (err) {
            throw err; // Fail if the file can't be read.
          }
          res.writeHead(200, { 'Content-Type': 'image/jpg' });
          res.end(data, 'binary');
        });
      }
    } else {
      res.status(404).json({ mensagemerro: 'Produto não localizado.' });
    }
  });
});

// Get one.
app.get('/produtos/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT id, nome, categoria, preco, quantidade, senha, datacricao FROM TbProduto WHERE idProduto = ?';
  dbconn.query(sql, [id], (erro, linhas) => {
    if (erro) {
      console.log(erro);
    } else {
      if (linhas.length > 0) {
        const produto = {
          id: linhas[0].id,
          nome: linhas[0].nome,
          categoria: linhas[0].categoria,
          preco: linhas[0].preco,
          quantidade: linhas[0].quantidade,
          senha: linhas[0].senha,
          datacriacao: linhas[0].datacriacao,
          foto: `http://localhost:3000/produtos/foto/${linhas[0].id}`,
        };
        res.json(produto);
      } else {
        res.status(404).json({ mensagemerro: 'Registro não localizado' });
      }
    }
  });
});



// DELETE: Excluir um produto do banco.
app.delete('/produtos/:id', (req, res) => {
  const idProduto = req.params.id;
  const sql = 'DELETE FROM TbProduto WHERE idProduto = ?';
  dbconn.query(sql, [idProduto], (err, result) => {
    if (err) {
    //  console.log(err);
      res.status(500).send('Erro ao excluir produto.');
    } else {
      res.send('Produto excluído com sucesso!');
    } 

  });
});

// Servidor rodado na porta 3000.
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor em execução na porta ${PORT}`);
});

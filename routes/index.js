const express = require('express');
const passport = require('passport');
const path = require('path');
const bcyrpt = require('bcrypt');
const multer  = require('multer')
const Users = require('../passport/user.js')
const S3 = require('../s3/s3.js');
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const router = express.Router();
const bcryptSettings = {
  saltRounds: 10
};

function getTimeStamp() {
  var d = new Date();
  var s =
    leadingZeros(d.getFullYear(), 4) + '-' +
    leadingZeros(d.getMonth() + 1, 2) + '-' +
    leadingZeros(d.getDate(), 2) + ' ' +

    leadingZeros(d.getHours(), 2) + ':' +
    leadingZeros(d.getMinutes(), 2) + ':' +
    leadingZeros(d.getSeconds(), 2);

  return s;
}
function leadingZeros(n, digits) {
  var zero = '';
  n = n.toString();

  if (n.length < digits) {
    for (i = 0; i < digits - n.length; i++)
      zero += '0';
  }
  return zero + n;
}

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

router.get('/signin', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(res.statusCode).json({'isAuthenticated': req.isAuthenticated(), 'id': req.user['id']});
  }
  else {
    res.sendFile('signIn.html', { root: path.join(__dirname, '../public/html') })
  }
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/status',
  failureRedirect: '/status'
}));

router.get('/signout', (req, res) => {
  req.logout();
  res.redirect('/signin');
});

router.post('/idcheck', (req, res) => {
  Users.idCheck(req.body['id'], (result) => {
    if (result == true) {
      res.status(res.statusCode).json({ idCheck: true });
    }
    else {
      res.status(res.statusCode).json({ idCheck: false });
    }
  });
});

router.get('/register', (req, res) => {
   res.sendFile('signUp.html', { root: path.join(__dirname, '../public/html') });
});

router.post('/register', upload.single('profileimage'), (req, res) => {
  S3.upload(req.body['id'] + '.' + req.file.originalname.split('.').pop(), req.file['buffer']);
  bcyrpt.hash(req.body['pw'], bcryptSettings.saltRounds, (err, hash) => {
    Users.signUp(req.body['id'], hash, req.body['username'], () => {
      res.json({'status': true});
    });
  });
});

router.get('/status', (req, res) => {
  res.status(res.statusCode).json({'status': req.isAuthenticated(), 'id': req.user['id']});
});

router.post('/writeboard', upload.single('photo'), (req, res) => {
  if (req.isAuthenticated()) {
    let id = req.user['id'];
    let title = req.body['title'];
    let date = getTimeStamp()
    let photo = req.file['buffer'];
    let bodyText = req.body['bodyText'];
    Users.getLastBoardNo((lastNo) => {
      S3.uploadBoardPhoto(lastNo + '.' + req.file.originalname.split('.').pop(), photo);
      Users.insertBoard(lastNo, id, title, date, bodyText);
      res.json({'status': true});
    });
  }
  else {
    res.json({'status': false, 'message': 'not authenticated'});
  }
});

router.get('/getboards', (req, res) => {
  Users.getBoards((results) => {
    let promiseArr = [];
    results.map((value) => {
      promiseArr.push(Users.getLike(value['no']));
      return value;
    });
    Promise.all(promiseArr).then((value) => {
      value.map((likeValues, index) => {
        results[index]['likes'] = [];
        value[index].map((likeValue) => {
          results[index]['likes'].push(likeValue['id']);
        });
      });
      res.json({'status': true, 'data': results});
    });
  });
});

router.post('/clicklike', (req, res) => {
  if (req.isAuthenticated()) {
    let no = req.body['no'];
    console.log(req.body);
    Users.clickLike(no, req.user['id'])
    res.json({'status': true});
  }
  else {
    res.json({'status': false, 'message': 'not authenticated'});
  }
});

router.post('/unclicklike', (req, res) => {
  if (req.isAuthenticated()) {
    let no = req.body['no'];
    console.log(no, req.user['id']);
    Users.unClickLike(no, req.user['id']);
    res.json({'status': true});
  }
  else {
    res.json({'status': false, 'message': 'not authenticated'});
  }
});

module.exports = router;

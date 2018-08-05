/*
	URL : /member/signup
	Description : 회원가입
	Content-type : form_data
	method : POST - Body
	Body = {
		member_type : int ,				/	일반인 : 1 , 공연자 : 2
		member_category : String ,		/	공연 카테고리 종류 , 일반인 경우에는 null
		member_ID : String , 			/	아이디
		member_PW : String ,			/	비밀번호
		member_nickname : String ,		/	닉네임
		member_profile : file  			/	디폴트 프로필 사진 
	}

	중복검사가 모두 완료되었을경우에만 진행 안그럴 경우 id PK 로 인해서 오류 발생
*/

const express = require('express');
const router = express.Router();
const pool = require('../../config/dbPool');
const async = require('async');
const moment = require( 'moment' ) ;

const crypto = require('crypto');

const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
aws.config.loadFromPath('../config/aws_config.json');	//	server 에서는 2개
const s3 = new aws.S3();

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'hyunho9304',
        acl: 'public-read',
        key: function(req, file, callback) {
            callback(null, Date.now() + '.' + file.originalname.split('.').pop());
        }
    })
});

router.post('/', upload.single('member_profile'), function(req, res) {

	let member_type = req.body.member_type ;
	let member_category = req.body.member_category ;
	let member_ID = req.body.member_ID ;
	let member_PW = req.body.member_PW ;
	let member_nickname = req.body.member_nickname ;
	let member_profile = req.file.location  ;

	let task = [

		function( callback ) {
			pool.getConnection(function(err , connection ) {
				if(err) {
					res.status(500).send({
						status : "fail" ,
						message : "internal server err"
					});
					callback( "getConnection err" );
				} else {
					callback( null , connection ) ;
				}
			});
		} ,

		function ( connection , callback ) {

			crypto.randomBytes( 32 , function ( err , buffer ) {
				if(err) {
					res.status(500).send({
						stauts : "fail" ,
						message : "internal server err"
					});
					connection.release() ;
					callback( "cryptoRandomBytes err" ) ;
				} else {

					let salt = buffer.toString( 'base64' ) ;

					crypto.pbkdf2( member_PW , salt , 100000 , 64 , 'sha512' , function( err , hashed ) {
						if( err ) {
							res.status(500).send({
								status : "fail" ,
								message : "internal server err"
							}) ;
							connection.release() ;
							callback( "cryptoPbkdf2 err") ;
						} else {

							let cryptopwd = hashed.toString( 'base64' ) ;

							let insertMemberQuery = 'INSERT INTO Member VALUES( ? , ? , ? , ? , ? , ? , ? )' ;
							let queryArr = [ member_type , member_category , member_ID , cryptopwd , salt , member_nickname , member_profile ] ;

							connection.query( insertMemberQuery , queryArr , function( err , result ) {
								if(err) {
									res.status(500).send({
										status : "fail" ,
										message : "internal server err"
									});
									connection.release() ;
									callback( "insertMemberQuery err" );
								} else {
									res.status(201).send({
										status : "success" ,
										message : "successful signup"
									});
									connection.release() ;
									callback( null , "successful signup" );
								}
							}) ;	//	connection query
						}
					}) ;	//	crypto pbkdf2
				}
			});	//	crypto randombytes
		}
	] ;

	async.waterfall(task, function(err, result) {
		
		let logtime = moment().format('MMMM Do YYYY, h:mm:ss a');

		if (err)
			console.log(' [ ' + logtime + ' ] ' + err);
		else
			console.log(' [ ' + logtime + ' ] ' + result);
	}); //async.waterfall
});	//	post

module.exports = router;















